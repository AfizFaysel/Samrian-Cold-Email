import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { organization } from "better-auth/plugins";
import { headers } from "next/headers";

import { ac, admin, member, owner } from "../../../lib/permissions";
import { getAuthDb } from "../db/db";
import { isSystemMailConfigured, sendSystemEmail } from "../mail/system";
import * as schema from "../db/schema";
import { getGoogleAuthConfig } from "./config";
import { logger } from "../observability/runtime";
import type { AuthProvider } from "./port";
import type { PermissionRequest, SessionData } from "./types";

// Samrian routes apply grantability, self-change, and audit rules to these actions. Direct HTTP
// calls would skip them. This only closes the HTTP routes, so auth.api calls still work.
const DISABLED_PATHS = [
  "/organization/update-member-role",
  "/organization/invite-member",
  "/organization/remove-member",
  "/organization/create-role",
  "/organization/update-role",
  "/organization/delete-role",
  "/organization/update",
  "/organization/delete",
  "/api-key/create",
  "/api-key/get",
  "/api-key/list",
  "/api-key/update",
  "/api-key/delete",
];

export function createAuthOptions(params?: { database?: BetterAuthOptions["database"] }) {
  const google = getGoogleAuthConfig();
  const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  return {
    appName: "ColdEmail MVP",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
    disabledPaths: DISABLED_PATHS,
    database:
      params?.database ??
      drizzleAdapter(getAuthDb(), {
        provider: "pg",
        usePlural: true,
        schema,
      }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...(isSystemMailConfigured()
      ? {
          emailVerification: {
            sendOnSignUp: true,
            // A mail outage must not stop sign-up, and only invitations need a verified address.
            async sendVerificationEmail({ user, url }) {
              await sendSystemEmail({
                to: user.email,
                subject: "Verify your email for Samrian",
                text: `Confirm this address by opening the link below.\n\n${url}\n`,
              }).catch(() => logger.warn("auth.verification_email_failed", {}));
            },
          } satisfies BetterAuthOptions["emailVerification"],
        }
      : {}),
    ...(google.enabled
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret,
            },
          },
        }
      : {}),
    plugins: [
      apiKey({
        configId: "automation",
        references: "organization",
        enableSessionForAPIKeys: false,
        // Samrian's API boundary owns tier-aware distributed limits. Better
        // Auth's separate key counter duplicates policy and requires adapter
        // atomic-increment support unavailable in its official Drizzle adapter.
        rateLimit: { enabled: false },
      }),
      organization({
        ac,
        roles: {
          owner,
          admin,
          member,
        },
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        membershipLimit: 100,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        // Sign-up does not prove ownership, so otherwise anyone could register an invited address.
        requireEmailVerificationOnInvitation: true,
        dynamicAccessControl: {
          enabled: true,
          maximumRolesPerOrganization: 20,
        },
        async sendInvitationEmail(data) {
          await sendSystemEmail({
            to: data.email,
            subject: `Join ${data.organization.name} on Samrian`,
            text:
              `${data.inviter.user.email} invited you to ${data.organization.name} on Samrian.\n\n` +
              `Accept the invitation: ${appUrl}/accept-invitation/${data.id}\n`,
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createBetterAuth() {
  return betterAuth(createAuthOptions());
}

export function createBetterAuthProvider(auth = createBetterAuth()): AuthProvider {
  async function getSession(): Promise<SessionData | null> {
    return (await auth.api.getSession({ headers: await headers() })) as SessionData | null;
  }

  return {
    getSession,
    async getActiveOrg() {
      const session = await getSession();
      const orgId = session?.session.activeOrganizationId;

      if (!session?.user || !orgId) {
        return null;
      }

      const activeMember = await auth.api
        .getActiveMember({ headers: await headers() })
        .catch(() => null);

      if (
        !activeMember ||
        activeMember.userId !== session.user.id ||
        activeMember.organizationId !== orgId
      ) {
        return null;
      }

      return {
        userId: session.user.id,
        orgId,
        role: activeMember.role,
        roles: [activeMember.role],
      };
    },
    async hasPermission(permissions: PermissionRequest) {
      const result = await auth.api.hasPermission({
        body: { permissions },
        headers: await headers(),
      });
      return result.success === true;
    },
  };
}
