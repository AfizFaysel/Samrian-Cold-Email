import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { GET as analytics } from "../../src/app/api/v1/analytics/org/route";
import { GET as blocklistList } from "../../src/app/api/v1/blocklist/route";
import { GET as campaignsList } from "../../src/app/api/v1/campaigns/route";
import { GET as capabilities } from "../../src/app/api/v1/capabilities/route";
import { GET as contactsList } from "../../src/app/api/v1/contacts/route";
import { GET as groupsList } from "../../src/app/api/v1/groups/route";
import { GET as inboxList } from "../../src/app/api/v1/inbox/route";
import { GET as limits } from "../../src/app/api/v1/limits/route";
import { GET as mailboxesList } from "../../src/app/api/v1/mailboxes/route";
import { createDb } from "../../src/server/db/db";
import { blocklist, campaigns, contacts, mailboxes } from "../../src/server/db/schema";
import { scopes } from "@samrian/contracts";
import { PostgresCampaignRepo, PostgresMailboxRepo } from "../../src/server/repos";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const orgId = "org_v1_reads";

vi.mock("../../src/server/auth/machine-provider", async (original) => ({
  ...(await original<typeof import("../../src/server/auth/machine-provider")>()),
  getMachineCredential: vi.fn(async () => ({
    verify: async () => ({
      credentialId: "key_reads",
      provider: "better-auth",
      orgId,
      scopes,
    }),
  })),
}));

// The wrapper turns a response that breaks its contract into a 500, so every read is exercised
// against real rows rather than a fixture shaped to pass.
describe.skipIf(!adminUrl || !appUrl)("v1 reads meet their contracts", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(blocklist).where(eq(blocklist.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
  }

  const get = (path: string) =>
    new Request(`http://localhost${path}`, { headers: { authorization: "Bearer sam_test" } });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", appUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("RATE_LIMIT_MODE", "off");
    await clean();
    await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      username: "login-name",
      dailySendLimit: 50,
    });
    await new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: {},
      steps: [{ subject: "Hello", body: "World" }],
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_reads", orgId, email: "lead@example.com", customVars: {} });
    await admin
      .insert(blocklist)
      .values({ id: "block_reads", orgId, email: "stop@example.com", reason: "manual" });
  });

  afterEach(() => undefined);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await clean();
  });

  test.each([
    ["capabilities", capabilities, "/api/v1/capabilities"],
    ["limits", limits, "/api/v1/limits"],
    ["mailboxes", mailboxesList, "/api/v1/mailboxes"],
    ["contacts", contactsList, "/api/v1/contacts"],
    ["campaigns", campaignsList, "/api/v1/campaigns"],
    ["groups", groupsList, "/api/v1/groups"],
    ["blocklist", blocklistList, "/api/v1/blocklist"],
    ["inbox", inboxList, "/api/v1/inbox"],
    ["analytics", analytics, "/api/v1/analytics/org"],
  ])("%s", async (_name, handler, path) => {
    const response = await handler(get(path));

    expect(response.status).toBe(200);
  });

  test("mailboxes expose ramp state and no login details", async () => {
    const response = await mailboxesList(get("/api/v1/mailboxes"));
    const body = (await response.json()) as { data: { items: Array<Record<string, unknown>> } };

    expect(body.data.items[0]).toMatchObject({
      name: "Sender",
      email: "sender@example.com",
      rampEnabled: expect.any(Boolean),
      effectiveDailyLimit: 50,
      availableToday: 50,
    });
    expect(body.data.items[0]).not.toHaveProperty("username");
  });
});
