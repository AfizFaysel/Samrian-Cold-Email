import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contacts,
  mailboxes,
  orgSettings,
} from "../../src/server/db/schema";
import { withTenant } from "../../src/server/db/tenant";
import { createCampaignLaunchDeps, launchCampaign } from "../../src/server/modules/campaigns";
import {
  PostgresCampaignRepo,
  PostgresMailboxRepo,
  PostgresSettingsRepo,
} from "../../src/server/repos";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const orgId = "org_rules";

describe.skipIf(!adminUrl || !appUrl)("launch rules on the app role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const app = createDb({ driver: "postgres-js", url: appUrl! }).client;

  async function clean() {
    await admin.delete(contactAssignments).where(eq(contactAssignments.orgId, orgId));
    await admin.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
    await admin.delete(orgSettings).where(eq(orgSettings.orgId, orgId));
  }

  const sender = (name: string) =>
    new PostgresMailboxRepo(admin).create({
      orgId,
      name,
      provider: "smtp",
      userEmail: `${name}@example.com`,
      dailySendLimit: 50,
    });

  async function seedDraft() {
    await new PostgresSettingsRepo(admin).upsertCompliance(orgId, {
      physicalAddress: "1 Main St",
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_rules", orgId, email: "lead@example.com", customVars: {} });
    return new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: {
        daysAllowed: ["monday"],
        startTime: "09:00",
        endTime: "17:00",
        defaultTimezone: "UTC",
      },
      steps: [{ subject: "Hello", body: "World" }],
      targetContactIds: ["contact_rules"],
    });
  }

  const launch = (campaignId: string, mailboxId: string) =>
    withTenant(app, { orgId, actorType: "request" }, (tx) =>
      launchCampaign({ campaignId, orgId, mailboxIds: [mailboxId] }, createCampaignLaunchDeps(tx))
    );

  const linked = async () => {
    const rows = await admin
      .select()
      .from(campaignMailboxes)
      .where(eq(campaignMailboxes.orgId, orgId));
    return rows.map((row) => row.mailboxId);
  };

  beforeEach(clean);
  afterAll(clean);

  test("launching again changes nothing and reports the campaign as it is", async () => {
    const campaign = await seedDraft();
    const first = await sender("first");
    const second = await sender("second");
    await launch(campaign.id, first.id);
    await admin
      .insert(contacts)
      .values({ id: "contact_late", orgId, email: "late@example.com", customVars: {} });
    await admin
      .update(campaigns)
      .set({ targetContactIds: ["contact_rules", "contact_late"] })
      .where(eq(campaigns.id, campaign.id));

    await expect(launch(campaign.id, second.id)).resolves.toMatchObject({
      status: "already-active",
      assignmentCount: 1,
      createdAssignments: 0,
      existingAssignments: 1,
      linkedMailboxCount: 1,
    });

    expect(await linked()).toEqual([first.id]);
  });

  test("a failure part way through leaves the campaign exactly as it was", async () => {
    const campaign = await seedDraft();
    const mailbox = await sender("first");

    await expect(
      withTenant(app, { orgId, actorType: "request" }, (tx) =>
        launchCampaign(
          { campaignId: campaign.id, orgId, mailboxIds: [mailbox.id] },
          {
            ...createCampaignLaunchDeps(tx),
            assignments: {
              createManyForCampaign: async () => {
                throw new Error("write failed after mailboxes were linked");
              },
            },
          }
        )
      )
    ).rejects.toThrow("write failed");

    const [row] = await admin.select().from(campaigns).where(eq(campaigns.id, campaign.id));
    expect(row.status).toBe("draft");
    expect(await linked()).toEqual([]);
    await expect(launch(campaign.id, mailbox.id)).resolves.toMatchObject({ status: "launched" });
  });

  test("two racing launches leave one set of mailboxes and one audience", async () => {
    const campaign = await seedDraft();
    const first = await sender("first");
    const second = await sender("second");

    const results = await Promise.all([
      launch(campaign.id, first.id),
      launch(campaign.id, second.id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(["already-active", "launched"]);
    expect(await linked()).toHaveLength(1);
    const assignments = await admin
      .select()
      .from(contactAssignments)
      .where(eq(contactAssignments.orgId, orgId));
    expect(assignments).toHaveLength(1);
  });
});
