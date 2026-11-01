import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contacts,
  mailboxes,
  sendReservations,
} from "../../src/server/db/schema";
import type { JobQueue } from "../../src/server/ports";
import {
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresMailboxRepo,
} from "../../src/server/repos";
import { createWorkerDeps } from "../../src/server/worker/deps";

const adminUrl = process.env.TEST_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const orgs = ["org_dispatch_a", "org_dispatch_b"];

// Owner connections bypass RLS, so this runs dispatch as the real worker role.
describe.skipIf(!adminUrl || !workerUrl)("dispatch on the worker database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(sendReservations).where(inArray(sendReservations.orgId, orgs));
    await admin.delete(contactAssignments).where(inArray(contactAssignments.orgId, orgs));
    await admin.delete(campaignMailboxes).where(inArray(campaignMailboxes.orgId, orgs));
    await admin.delete(campaigns).where(inArray(campaigns.orgId, orgs));
    await admin.delete(mailboxes).where(inArray(mailboxes.orgId, orgs));
    await admin.delete(contacts).where(inArray(contacts.orgId, orgs));
  }

  async function seed(orgId: string) {
    const mailbox = await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: `sender@${orgId}.example.com`,
      dailySendLimit: 50,
    });
    const campaign = await new PostgresCampaignRepo(admin).create({
      orgId,
      name: "Launch",
      schedule: {},
      steps: [{ subject: "Hello", body: "World" }],
    });
    await admin.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, campaign.id));
    await new PostgresCampaignMailboxRepo(admin).replaceForCampaign({
      campaignId: campaign.id,
      orgId,
      mailboxIds: [mailbox.id],
    });
    const contactId = `contact_${orgId}`;
    await admin
      .insert(contacts)
      .values({ id: contactId, orgId, email: `lead@${orgId}.example.com`, customVars: {} });
    const assignmentId = `assignment_${orgId}`;
    await admin.insert(contactAssignments).values({
      id: assignmentId,
      orgId,
      campaignId: campaign.id,
      contactId,
      status: "active",
    });
    return { mailbox, campaign, assignmentId };
  }

  function queue() {
    return { enqueueCampaignSend: vi.fn(async () => ({ jobId: "job" })) };
  }

  beforeEach(async () => {
    vi.stubEnv("WORKER_DATABASE_URL", workerUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("RATE_LIMIT_MODE", "off");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("reserves capacity and enqueues a due send", async () => {
    const { mailbox, assignmentId } = await seed(orgs[0]);
    const jobs = queue();

    const result = await createWorkerDeps(jobs as unknown as JobQueue).dispatchDueSends();

    expect(result).toMatchObject({ enqueued: 1, missingCapacity: 0 });
    expect(jobs.enqueueCampaignSend).toHaveBeenCalledOnce();
    const [reservation] = await admin
      .select()
      .from(sendReservations)
      .where(eq(sendReservations.assignmentId, assignmentId));
    expect(reservation).toMatchObject({ orgId: orgs[0], mailboxId: mailbox.id });
    const [counted] = await admin.select().from(mailboxes).where(eq(mailboxes.id, mailbox.id));
    expect(counted.reservedSends).toBe(1);
  });

  test("keeps each organization's work in its own tenant", async () => {
    const first = await seed(orgs[0]);
    const second = await seed(orgs[1]);
    const jobs = queue();

    const result = await createWorkerDeps(jobs as unknown as JobQueue).dispatchDueSends();

    expect(result.enqueued).toBe(2);
    const reservations = await admin
      .select()
      .from(sendReservations)
      .where(inArray(sendReservations.orgId, orgs));
    expect(reservations.map((row) => [row.orgId, row.mailboxId]).sort()).toEqual(
      [
        [orgs[0], first.mailbox.id],
        [orgs[1], second.mailbox.id],
      ].sort()
    );
  });
});
