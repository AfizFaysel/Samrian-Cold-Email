import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contacts,
  mailboxes,
  orgSettings,
  sendReservations,
} from "../../src/server/db/schema";
import { withTenant } from "../../src/server/db/tenant";
import { createCampaignLaunchDeps, resumeCampaign } from "../../src/server/modules/campaigns";
import type { JobQueue } from "../../src/server/ports";
import {
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresMailboxRepo,
  PostgresSettingsRepo,
} from "../../src/server/repos";
import { createWorkerDeps } from "../../src/server/worker/deps";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const orgId = "org_resume";

describe.skipIf(!adminUrl || !appUrl || !workerUrl)("resuming a paused campaign", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const app = createDb({ driver: "postgres-js", url: appUrl! }).client;

  async function clean() {
    await admin.delete(sendReservations).where(eq(sendReservations.orgId, orgId));
    await admin.delete(contactAssignments).where(eq(contactAssignments.orgId, orgId));
    await admin.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
    await admin.delete(orgSettings).where(eq(orgSettings.orgId, orgId));
  }

  async function seedPaused() {
    await new PostgresSettingsRepo(admin).upsertCompliance(orgId, {
      physicalAddress: "1 Main St",
    });
    const mailbox = await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit: 50,
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_resume", orgId, email: "lead@example.com", customVars: {} });
    const campaign = await new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: {
        daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        startTime: "00:00",
        endTime: "23:59",
      },
      steps: [{ subject: "Hello", body: "World" }],
      targetContactIds: ["contact_resume"],
    });
    await admin.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
    await new PostgresCampaignMailboxRepo(admin).replaceForCampaign({
      campaignId: campaign.id,
      orgId,
      mailboxIds: [mailbox.id],
    });
    await admin.insert(contactAssignments).values({
      id: "assignment_resume",
      orgId,
      campaignId: campaign.id,
      contactId: "contact_resume",
      status: "active",
    });
    return campaign;
  }

  const resume = (campaignId: string) =>
    withTenant(app, { orgId, actorType: "request" }, (tx) =>
      resumeCampaign({ campaignId, orgId }, createCampaignLaunchDeps(tx))
    );

  async function dispatch() {
    const enqueueCampaignSend = vi.fn(async () => ({ jobId: "job_1" }));
    await createWorkerDeps({ enqueueCampaignSend } as unknown as JobQueue).dispatchDueSends();
    return enqueueCampaignSend;
  }

  beforeEach(async () => {
    vi.stubEnv("WORKER_DATABASE_URL", workerUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("RATE_LIMIT_MODE", "off");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("contacts held during the pause go out once it resumes", async () => {
    const campaign = await seedPaused();
    expect(await dispatch()).not.toHaveBeenCalled();

    await expect(resume(campaign.id)).resolves.toEqual({
      status: "resumed",
      campaignId: campaign.id,
    });

    const enqueued = await dispatch();
    expect(enqueued).toHaveBeenCalledOnce();
    expect(enqueued).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: "assignment_resume" }),
      expect.anything()
    );
  });

  test("a second resume is refused and changes nothing", async () => {
    const campaign = await seedPaused();
    await resume(campaign.id);

    await expect(resume(campaign.id)).rejects.toMatchObject({
      issues: ["Only paused campaigns can be resumed"],
    });
  });

  test("stays paused while the organization has no physical address", async () => {
    const campaign = await seedPaused();
    await new PostgresSettingsRepo(admin).upsertCompliance(orgId, { physicalAddress: null });

    await expect(resume(campaign.id)).rejects.toMatchObject({
      issues: ["Physical mailing address is required"],
    });
    const [row] = await admin.select().from(campaigns).where(eq(campaigns.id, campaign.id));
    expect(row.status).toBe("paused");
  });

  test("another organization cannot resume it", async () => {
    const campaign = await seedPaused();

    await expect(
      withTenant(app, { orgId: "org_other", actorType: "request" }, (tx) =>
        resumeCampaign(
          { campaignId: campaign.id, orgId: "org_other" },
          createCampaignLaunchDeps(tx)
        )
      )
    ).rejects.toMatchObject({ issues: ["Campaign not found"] });
  });
});
