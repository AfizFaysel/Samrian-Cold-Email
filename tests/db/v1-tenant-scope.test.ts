import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST as addBlock } from "../../src/app/api/v1/blocklist/route";
import { POST as launch } from "../../src/app/api/v1/campaigns/[id]/launch/route";
import { POST as validate } from "../../src/app/api/v1/campaigns/[id]/validate/route";
import { POST as createCampaign } from "../../src/app/api/v1/campaigns/route";
import { POST as createGroup } from "../../src/app/api/v1/groups/route";
import { createDb } from "../../src/server/db/db";
import {
  apiIdempotency,
  blocklist,
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contactGroups,
  contacts,
  mailboxes,
  orgSettings,
} from "../../src/server/db/schema";
import {
  PostgresCampaignRepo,
  PostgresMailboxRepo,
  PostgresSettingsRepo,
} from "../../src/server/repos";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const orgId = "org_v1_scope";

vi.mock("../../src/server/auth/machine-provider", async (original) => ({
  ...(await original<typeof import("../../src/server/auth/machine-provider")>()),
  getMachineCredential: vi.fn(async () => ({
    verify: async () => ({
      credentialId: "key_scope",
      provider: "better-auth",
      orgId,
      userId: "user_scope",
      scopes: [
        "blocklist:write",
        "campaigns:read",
        "campaigns:write",
        "campaigns:launch",
        "groups:write",
      ],
    }),
  })),
}));

// Owner connections bypass RLS, so only the restricted role shows a write outside the tenant scope.
describe.skipIf(!adminUrl || !appUrl)("v1 writes on the app database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(apiIdempotency).where(eq(apiIdempotency.orgId, orgId));
    await admin.delete(blocklist).where(eq(blocklist.orgId, orgId));
    await admin.delete(contactAssignments).where(eq(contactAssignments.orgId, orgId));
    await admin.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(contactGroups).where(eq(contactGroups.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
    await admin.delete(orgSettings).where(eq(orgSettings.orgId, orgId));
  }

  const request = (path: string, body: unknown) =>
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        authorization: "Bearer sam_test",
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

  async function seedDraft() {
    await new PostgresSettingsRepo(admin).upsertCompliance(orgId, {
      physicalAddress: "1 Main St",
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_scope", orgId, email: "lead@example.com", customVars: {} });
    const mailbox = await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit: 50,
    });
    const campaign = await new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: { daysAllowed: ["monday"], startTime: "09:00", endTime: "17:00" },
      steps: [{ subject: "Hello", body: "World" }],
      targetContactIds: ["contact_scope"],
    });
    return { campaign, mailbox };
  }

  beforeEach(async () => {
    vi.stubEnv("DATABASE_URL", appUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("RATE_LIMIT_MODE", "off");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("adds to the blocklist", async () => {
    const response = await addBlock(request("/api/v1/blocklist", { email: "stop@example.com" }));

    expect(response.status).toBe(200);
  });

  test("creates a campaign draft", async () => {
    const response = await createCampaign(
      request("/api/v1/campaigns", { name: "Draft", schedule: {}, steps: [{ subject: "Hi" }] })
    );

    expect(response.status).toBe(200);
  });

  test("creates a group", async () => {
    const response = await createGroup(request("/api/v1/groups", { name: "Group" }));

    expect(response.status).toBe(200);
  });

  test("validates and launches a campaign", async () => {
    const { campaign, mailbox } = await seedDraft();
    const context = { params: Promise.resolve({ id: campaign.id }) };
    const body = { mailboxIds: [mailbox.id] };

    const checked = await validate(request("/validate", body), context);
    expect(checked.status).toBe(200);

    const launched = await launch(request("/launch", body), context);
    expect(launched.status).toBe(200);
    await expect(launched.json()).resolves.toMatchObject({ data: { status: "launched" } });
  });
});
