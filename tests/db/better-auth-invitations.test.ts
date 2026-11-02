import { betterAuth } from "better-auth";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createAuthOptions } from "../../src/server/auth/better";
import { createDb } from "../../src/server/db/db";
import {
  accounts,
  apiKeys,
  invitations,
  members,
  organizations,
  sessions,
  users,
  verifications,
} from "../../src/server/db/schema";
import { sendSystemEmail } from "../../src/server/mail/system";

vi.mock("../../src/server/mail/system", () => ({
  isSystemMailConfigured: () => true,
  sendSystemEmail: vi.fn(async () => {}),
}));

const adminUrl = process.env.TEST_DATABASE_URL;
const authUrl = process.env.TEST_AUTH_DATABASE_URL;
const origin = "http://app.test";
const suffix = crypto.randomUUID();
const password = "correct-horse-battery";
const address = (name: string) => `${name}-${suffix}@example.com`;

describe.skipIf(!adminUrl || !authUrl)("invitations on the auth database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const createAuth = () => betterAuth(createAuthOptions());
  let auth: ReturnType<typeof createAuth>;
  let api: Record<string, (input: unknown) => Promise<never>>;
  let owner: Headers;
  let organizationId: string;
  const created: string[] = [];

  async function register(email: string, verified = false) {
    await auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ email, password, name: "Person" }),
      })
    );
    const [user] = await admin.select().from(users).where(eq(users.email, email));
    created.push(user.id);
    if (verified) {
      await admin.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
    }
    const signIn = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    );
    return new Headers({
      cookie: signIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    });
  }

  const invite = async (email: string, role = "admin") =>
    (await api.createInvitation({
      headers: owner,
      body: { organizationId, email, role },
    })) as { id: string };

  const accept = (headers: Headers, invitationId: string) =>
    auth.handler(
      new Request(`${origin}/api/auth/organization/accept-invitation`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", cookie: headers.get("cookie")! },
        body: JSON.stringify({ invitationId }),
      })
    );

  beforeAll(async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("BETTER_AUTH_URL", origin);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("AUTH_DATABASE_URL", authUrl!);
    auth = createAuth();
    api = auth.api as unknown as typeof api;
    owner = await register(address("owner"), true);
    const organization = await api.createOrganization({
      headers: owner,
      body: { name: "Acme", slug: `acme-${suffix}` },
    });
    organizationId = (organization as { id: string }).id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await admin.delete(apiKeys).where(eq(apiKeys.referenceId, organizationId));
    await admin.delete(invitations).where(eq(invitations.organizationId, organizationId));
    await admin.delete(members).where(eq(members.organizationId, organizationId));
    await admin.delete(organizations).where(eq(organizations.id, organizationId));
    await admin.delete(sessions).where(inArray(sessions.userId, created));
    await admin.delete(accounts).where(inArray(accounts.userId, created));
    await admin.delete(users).where(inArray(users.id, created));
    await admin.delete(verifications);
  });

  test("an organization cannot be deleted while no purge runs with it", async () => {
    await expect(
      api.deleteOrganization({ headers: owner, body: { organizationId } })
    ).rejects.toThrow();

    const [organization] = await admin
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    expect(organization).toBeDefined();
  });

  test("the schema still passes the library's startup check", async () => {
    await (await auth.$context).checkSchema?.();
  });

  test("signing up sends a verification email", async () => {
    const email = address("verify");
    vi.mocked(sendSystemEmail).mockClear();

    await register(email);

    expect(sendSystemEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: email, text: expect.stringContaining("/verify-email") })
    );
  });

  test("an invitation is emailed with its link and never logged", async () => {
    const log = vi.spyOn(console, "log");
    vi.mocked(sendSystemEmail).mockClear();
    const email = address("emailed");

    const invitation = await invite(email);

    expect(sendSystemEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        text: expect.stringContaining(`${origin}/accept-invitation/${invitation.id}`),
      })
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(invitation.id);
    log.mockRestore();
  });

  test("someone who only registered the invited address cannot accept", async () => {
    const email = address("attacker");
    const invitation = await invite(email);
    const attacker = await register(email);

    const response = await accept(attacker, invitation.id);

    expect(response.status).toBe(403);
    const joined = await admin
      .select()
      .from(members)
      .where(eq(members.organizationId, organizationId));
    expect(joined.map((member) => member.role)).toEqual(["owner"]);
  });

  test("another verified person cannot take an invitation", async () => {
    const invitation = await invite(address("intended"));
    const other = await register(address("other"), true);

    expect((await accept(other, invitation.id)).status).toBe(403);
  });

  test("the verified invitee joins with the invited role", async () => {
    const email = address("invitee");
    const invitation = await invite(email, "admin");
    const invitee = await register(email, true);

    expect((await accept(invitee, invitation.id)).status).toBe(200);
    await api.setActiveOrganization({ headers: invitee, body: { organizationId } });
    await expect(api.getActiveMember({ headers: invitee })).resolves.toMatchObject({
      role: "admin",
    });
  });

  test("admins can list and revoke API keys, as Samrian's policy says", async () => {
    const email = address("keys");
    const invitation = await invite(email, "admin");
    const keyAdmin = await register(email, true);
    await accept(keyAdmin, invitation.id);
    const session = (await api.getSession({ headers: owner })) as { user: { id: string } };
    const key = (await api.createApiKey({
      body: {
        configId: "automation",
        name: "CI",
        organizationId,
        userId: session.user.id,
        permissions: { contacts: ["read"] },
      },
    })) as { id: string };

    await expect(
      api.listApiKeys({
        headers: keyAdmin,
        query: { configId: "automation", organizationId },
      })
    ).resolves.toMatchObject({ apiKeys: [expect.objectContaining({ id: key.id })] });
    await expect(
      api.updateApiKey({
        headers: keyAdmin,
        body: { configId: "automation", keyId: key.id, organizationId, enabled: false },
      })
    ).resolves.toMatchObject({ enabled: false });
  });

  describe("database constraints", () => {
    const fresh = () => crypto.randomUUID();

    test.each([
      [
        "an email in any case",
        async (id: string) => {
          await admin.insert(users).values({
            id,
            email: address("owner").toUpperCase(),
            name: "Copy",
          });
        },
      ],
      [
        "an organization slug",
        async (id: string) => {
          await admin.insert(organizations).values({ id, name: "Copy", slug: `acme-${suffix}` });
        },
      ],
      [
        "a membership",
        async (id: string) => {
          const [existing] = await admin
            .select()
            .from(members)
            .where(eq(members.organizationId, organizationId))
            .limit(1);
          await admin.insert(members).values({ ...existing, id });
        },
      ],
      [
        "a session token",
        async (id: string) => {
          const [existing] = await admin.select().from(sessions).limit(1);
          await admin.insert(sessions).values({ ...existing, id });
        },
      ],
      [
        "a provider account",
        async (id: string) => {
          const [existing] = await admin
            .select()
            .from(accounts)
            .where(eq(accounts.userId, created[0]))
            .limit(1);
          await admin.insert(accounts).values({ ...existing, id });
        },
      ],
    ])("rejects a duplicate of %s", async (_name, insert) => {
      await expect(insert(fresh())).rejects.toThrow();
    });
  });
});
