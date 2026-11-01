import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  emailEvents,
  mailboxes,
} from "../../src/server/db/schema";
import {
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresEventRepo,
  PostgresMailboxRepo,
  PostgresStatsRepo,
} from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("campaign list repos", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const campaignsRepo = new PostgresCampaignRepo(db);
  const mailboxesRepo = new PostgresMailboxRepo(db);
  const campaignMailboxesRepo = new PostgresCampaignMailboxRepo(db);
  const statsRepo = new PostgresStatsRepo(db);
  const eventsRepo = new PostgresEventRepo(db);

  beforeEach(async () => {
    for (const org of ["org_list_a", "org_list_b"]) {
      await db.delete(emailEvents).where(eq(emailEvents.orgId, org));
      await db.delete(contactAssignments).where(eq(contactAssignments.orgId, org));
      await db.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, org));
      await db.delete(campaigns).where(eq(campaigns.orgId, org));
      await db.delete(mailboxes).where(eq(mailboxes.orgId, org));
    }
  });

  test("mapForCampaigns returns mailbox ids for many campaigns in one call", async () => {
    const sender = await mailboxesRepo.create({
      orgId: "org_list_a",
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit: 50,
    });
    const first = await campaignsRepo.create({
      orgId: "org_list_a",
      name: "First",
      schedule: {},
      steps: [],
    });
    const second = await campaignsRepo.create({
      orgId: "org_list_a",
      name: "Second",
      schedule: {},
      steps: [],
    });
    await campaignMailboxesRepo.replaceForCampaign({
      campaignId: first.id,
      orgId: "org_list_a",
      mailboxIds: [sender.id],
    });

    const map = await campaignMailboxesRepo.mapForCampaigns([first.id, second.id], "org_list_a");

    expect(map.get(first.id)).toEqual([sender.id]);
    expect(map.get(second.id)).toEqual([]);
    expect(await campaignMailboxesRepo.mapForCampaigns([], "org_list_a")).toEqual(new Map());
  });

  test("mapForCampaigns never leaks cross-org links", async () => {
    const foreign = await campaignsRepo.create({
      orgId: "org_list_b",
      name: "Foreign",
      schedule: {},
      steps: [],
    });
    const foreignSender = await mailboxesRepo.create({
      orgId: "org_list_b",
      name: "Foreign sender",
      provider: "smtp",
      userEmail: "foreign@example.com",
      dailySendLimit: 50,
    });
    await campaignMailboxesRepo.replaceForCampaign({
      campaignId: foreign.id,
      orgId: "org_list_b",
      mailboxIds: [foreignSender.id],
    });

    const map = await campaignMailboxesRepo.mapForCampaigns([foreign.id], "org_list_a");

    expect(map.get(foreign.id)).toEqual([]);
  });

  test("getStats counts assignment statuses and is org-scoped", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_list_a",
      name: "Stats",
      schedule: {},
      steps: [],
    });
    await db.insert(contactAssignments).values([
      {
        id: "asg_stats_1",
        orgId: "org_list_a",
        campaignId: campaign.id,
        contactId: "con_1",
        status: "active",
      },
      {
        id: "asg_stats_2",
        orgId: "org_list_a",
        campaignId: campaign.id,
        contactId: "con_2",
        status: "bounced",
      },
      {
        id: "asg_stats_3",
        orgId: "org_list_b",
        campaignId: campaign.id,
        contactId: "con_3",
        status: "unsubscribed",
      },
    ]);

    await expect(campaignsRepo.getStats(campaign.id, "org_list_a")).resolves.toEqual({
      campaignId: campaign.id,
      total: 2,
      bounced: 1,
      unsubscribed: 0,
    });
    await expect(campaignsRepo.getStats(campaign.id, "org_list_b")).resolves.toEqual({
      campaignId: campaign.id,
      total: 1,
      bounced: 0,
      unsubscribed: 1,
    });
  });

  test("sumByCampaign aggregates rollups per campaign in one query", async () => {
    const first = await campaignsRepo.create({
      orgId: "org_list_a",
      name: "Roll A",
      schedule: {},
      steps: [],
    });
    const second = await campaignsRepo.create({
      orgId: "org_list_a",
      name: "Roll B",
      schedule: {},
      steps: [],
    });
    await eventsRepo.record({
      orgId: "org_list_a",
      campaignId: first.id,
      type: "sent",
      dedupeKey: "sent-1",
      occurredAt: Date.now(),
    });
    await eventsRepo.record({
      orgId: "org_list_a",
      campaignId: first.id,
      type: "reply",
      dedupeKey: "reply-1",
      occurredAt: Date.now(),
    });
    await eventsRepo.record({
      orgId: "org_list_a",
      campaignId: second.id,
      type: "sent",
      dedupeKey: "sent-2",
      occurredAt: Date.now(),
    });

    const map = await statsRepo.sumByCampaign("org_list_a");

    expect(map.get(first.id)?.sent).toBe(1);
    expect(map.get(first.id)?.replies).toBe(1);
    expect(map.get(second.id)?.sent).toBe(1);
  });
});
