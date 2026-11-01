import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import {
  blocklist,
  campaigns,
  contactAssignments,
  contacts,
  emailEvents,
  mailboxes,
} from "../../src/server/db/schema";
import { createUnsubscribeToken, unsubscribeContact } from "../../src/server/modules/unsubscribe";
import { PostgresCampaignRepo, PostgresMailboxRepo } from "../../src/server/repos";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const orgId = "org_unsub_link";

describe.skipIf(!adminUrl || !appUrl)("unsubscribe link on the app database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(emailEvents).where(eq(emailEvents.orgId, orgId));
    await admin.delete(blocklist).where(eq(blocklist.orgId, orgId));
    await admin.delete(contactAssignments).where(eq(contactAssignments.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
  }

  beforeEach(async () => {
    vi.stubEnv("DATABASE_URL", appUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "a".repeat(32));
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("attributes the unsubscribe to the mailbox that sent the campaign", async () => {
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
      schedule: {},
      steps: [],
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_link", orgId, email: "lead@example.com", customVars: {} });
    await admin.insert(contactAssignments).values({
      id: "assignment_link",
      orgId,
      campaignId: campaign.id,
      contactId: "contact_link",
      assignedMailboxId: mailbox.id,
      status: "active",
    });

    const result = await unsubscribeContact({
      contactId: "contact_link",
      campaignId: campaign.id,
      token: createUnsubscribeToken({ orgId, contactId: "contact_link", campaignId: campaign.id }),
    });

    expect(result).toMatchObject({ success: true });
    const events = await admin.select().from(emailEvents).where(eq(emailEvents.orgId, orgId));
    expect(events).toMatchObject([{ type: "unsubscribe", mailboxId: mailbox.id }]);
  });

  test("records the opt-out over an earlier manual block", async () => {
    const campaign = await new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: {},
      steps: [],
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_link", orgId, email: "lead@example.com", customVars: {} });
    await admin
      .insert(blocklist)
      .values({ id: "block_link", orgId, email: "lead@example.com", reason: "manual" });

    await unsubscribeContact({
      contactId: "contact_link",
      campaignId: campaign.id,
      token: createUnsubscribeToken({ orgId, contactId: "contact_link", campaignId: campaign.id }),
    });

    const entries = await admin.select().from(blocklist).where(eq(blocklist.orgId, orgId));
    expect(entries).toMatchObject([{ reason: "unsubscribed" }]);
  });
});
