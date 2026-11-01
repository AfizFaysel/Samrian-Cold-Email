import { betterAuth } from "better-auth";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createAuthOptions } from "../../src/server/auth/better";
import { createDb } from "../../src/server/db/db";
import {
  accounts,
  apiKeys,
  members,
  organizationRoles,
  organizations,
  sessions,
  users,
} from "../../src/server/db/schema";

const adminUrl = process.env.TEST_DATABASE_URL;
const authUrl = process.env.TEST_AUTH_DATABASE_URL;
const origin = "http://app.test";
const suffix = crypto.randomUUID();
const email = `owner-${suffix}@example.com`;
const password = "correct-horse-battery";

// Runs the real config as the restricted auth role. The startup schema check rejects auth
// requests on any mismatch, so this is what proves migrations match the library.
describe.skipIf(!adminUrl || !authUrl)("Better Auth on the auth database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const createAuth = () => betterAuth(createAuthOptions());
  let auth: ReturnType<typeof createAuth>;
  let api: Record<string, (input: unknown) => Promise<never>>;
  let headers: Headers;
  let organizationId: string;

  function post(path: string, body: unknown) {
    return auth.handler(
      new Request(`${origin}/api/auth${path}`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  beforeAll(async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("BETTER_AUTH_URL", origin);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("AUTH_DATABASE_URL", authUrl!);
    auth = createAuth();
    api = auth.api as unknown as typeof api;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    const owner = await admin
      .select()
      .from(users)
      .where(inArray(users.email, [email]));
    const ids = owner.map((row) => row.id);
    if (ids.length) {
      await admin.delete(apiKeys).where(inArray(apiKeys.referenceId, [organizationId]));
      await admin
        .delete(organizationRoles)
        .where(inArray(organizationRoles.organizationId, [organizationId]));
      await admin.delete(members).where(inArray(members.userId, ids));
      await admin.delete(organizations).where(inArray(organizations.id, [organizationId]));
      await admin.delete(sessions).where(inArray(sessions.userId, ids));
      await admin.delete(accounts).where(inArray(accounts.userId, ids));
      await admin.delete(users).where(inArray(users.id, ids));
    }
  });

  test("the migrated schema passes the library's startup check", async () => {
    const context = await auth.$context;

    await context.checkSchema?.();
  });

  test("signs up and signs in through HTTP", async () => {
    const signUp = await post("/sign-up/email", { email, password, name: "Owner" });
    const signIn = await post("/sign-in/email", { email, password });

    expect([signUp.status, signIn.status]).toEqual([200, 200]);
    const cookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    headers = new Headers({ cookie });
  });

  test("creates an organization and activates it", async () => {
    const organization = await api.createOrganization({
      headers,
      body: { name: "Acme", slug: `acme-${suffix}` },
    });
    organizationId = (organization as { id: string }).id;
    await api.setActiveOrganization({ headers, body: { organizationId } });

    const session = await api.getSession({ headers });
    const member = await api.getActiveMember({ headers });

    expect(session).toMatchObject({ session: { activeOrganizationId: organizationId } });
    expect(member).toMatchObject({ role: "owner" });
  });

  test("checks permissions, allowing and denying from the real role", async () => {
    const allowed = await api.hasPermission({
      headers,
      body: { permissions: { contact: ["delete"] } },
    });
    const denied = await api.hasPermission({
      headers,
      body: { permissions: { campaign: ["fly"] } },
    });

    expect(allowed).toMatchObject({ success: true });
    expect(denied).toMatchObject({ success: false });
  });

  test("creates a custom role", async () => {
    const role = await api.createOrgRole({
      headers,
      body: { organizationId, role: `support-${suffix}`, permission: { contact: ["read"] } },
    });

    expect(role).toMatchObject({ success: true });
  });

  test("creates and verifies an organization API key", async () => {
    const session = (await api.getSession({ headers })) as { user: { id: string } };
    const key = await api.createApiKey({
      body: {
        configId: "automation",
        name: "CI",
        organizationId,
        userId: session.user.id,
        permissions: { contacts: ["read"] },
      },
    });

    const verified = await api.verifyApiKey({
      body: { key: (key as { key: string }).key, configId: "automation" },
    });

    expect(verified).toMatchObject({ valid: true, key: { referenceId: organizationId } });
  });
});
