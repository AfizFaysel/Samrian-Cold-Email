import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contacts,
  emailEvents,
  mailboxes,
  sendReservations,
  threads,
} from "../../src/server/db/schema";
import { withTenant } from "../../src/server/db/tenant";
import { sendCampaign } from "../../src/server/jobs/send";
import type { JobQueue } from "../../src/server/ports";
import {
  createPostgresJobRepos,
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresMailboxRepo,
} from "../../src/server/repos";
import { createWorkerDeps } from "../../src/server/worker/deps";

const adminUrl = process.env.TEST_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const orgId = "org_send";

// Owner connections bypass RLS and locking differs under load, so these use the worker role.
describe.skipIf(!adminUrl || !workerUrl)("sending on the worker database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const worker = createDb({ driver: "postgres-js", url: workerUrl! }).client;

  async function clean() {
    await admin.delete(sendReservations).where(eq(sendReservations.orgId, orgId));
    await admin.delete(threads).where(eq(threads.orgId, orgId));
    await admin.delete(emailEvents).where(eq(emailEvents.orgId, orgId));
    await admin.delete(contactAssignments).where(eq(contactAssignments.orgId, orgId));
    await admin.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, orgId));
    await admin.delete(campaigns).where(eq(campaigns.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
    await admin.delete(contacts).where(eq(contacts.orgId, orgId));
  }

  async function seed(
    steps: unknown[] = [{ subject: "Hello", body: "World" }, { subject: "Bye" }]
  ) {
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
      steps,
    });
    await admin.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, campaign.id));
    await new PostgresCampaignMailboxRepo(admin).replaceForCampaign({
      campaignId: campaign.id,
      orgId,
      mailboxIds: [mailbox.id],
    });
    await admin
      .insert(contacts)
      .values({ id: "contact_send", orgId, email: "lead@example.com", customVars: {} });
    await admin.insert(contactAssignments).values({
      id: "assignment_send",
      orgId,
      campaignId: campaign.id,
      contactId: "contact_send",
      status: "active",
    });
    await new PostgresCampaignMailboxRepo(admin).reserveCapacity({
      mailboxId: mailbox.id,
      assignmentId: "assignment_send",
      stepNumber: 0,
      orgId,
      limit: 50,
      now: Date.now(),
    });
    return {
      payload: {
        assignmentId: "assignment_send",
        campaignId: campaign.id,
        contactId: "contact_send",
        mailboxId: mailbox.id,
        orgId,
        stepNumber: 0,
      },
      mailbox,
      campaign,
    };
  }

  function deps(
    connectorSend: (...args: never[]) => Promise<{ messageId: string }>,
    overrides: { failFinalize?: () => boolean; now?: () => number } = {}
  ) {
    return {
      transaction: <T>(operation: (repos: never) => Promise<T>) => {
        if (overrides.failFinalize?.()) throw new Error("database went away");
        return withTenant(worker, { orgId, actorType: "worker" }, (tx) =>
          operation(createPostgresJobRepos(tx) as never)
        );
      },
      connectorForMailbox: async () =>
        ({ send: connectorSend, close: async () => undefined }) as never,
      generateUnsubscribeToken: async () => "token",
      appUrl: "http://app.test",
      now: overrides.now ?? Date.now,
      getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
    };
  }

  test("refuses to build an unsubscribe link for localhost in production", async () => {
    const { payload } = await seed();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    await expect(async () => createWorkerDeps().sendCampaign(payload)).rejects.toThrow(
      "NEXT_PUBLIC_APP_URL is required"
    );
  });

  const delivered = () => vi.fn(async () => ({ messageId: `<${crypto.randomUUID()}@test>` }));
  const assignment = async () => {
    const [row] = await admin
      .select()
      .from(contactAssignments)
      .where(eq(contactAssignments.id, "assignment_send"));
    return row;
  };
  const reservation = async () => {
    const [row] = await admin
      .select()
      .from(sendReservations)
      .where(eq(sendReservations.assignmentId, "assignment_send"));
    return row;
  };
  const mailboxRow = async (id: string) => {
    const [row] = await admin.select().from(mailboxes).where(eq(mailboxes.id, id));
    return row;
  };

  beforeEach(async () => {
    vi.stubEnv("WORKER_DATABASE_URL", workerUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    vi.stubEnv("RATE_LIMIT_MODE", "off");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("delivers once and records the send", async () => {
    const { payload, mailbox } = await seed();
    const send = delivered();

    const result = await sendCampaign(payload, deps(send));

    expect(result.status).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
    expect(await reservation()).toBeUndefined();
    expect(await assignment()).toMatchObject({ currentStep: 1, status: "active" });
    expect(await mailboxRow(mailbox.id)).toMatchObject({ emailsSentToday: 1, reservedSends: 0 });
    const sent = await admin.select().from(threads).where(eq(threads.orgId, orgId));
    expect(sent).toHaveLength(1);
  });

  test("a second worker arriving mid-delivery does not send", async () => {
    const { payload } = await seed();
    const secondSend = delivered();
    let second: Awaited<ReturnType<typeof sendCampaign>> | undefined;
    const firstSend = vi.fn(async () => {
      second = await sendCampaign(payload, deps(secondSend));
      return { messageId: "<first@test>" };
    });

    const first = await sendCampaign(payload, deps(firstSend));

    expect(first.status).toBe("sent");
    expect(second?.status).toBe("in-progress");
    expect(secondSend).not.toHaveBeenCalled();
  });

  test("two workers racing for one job always deliver exactly one email", async () => {
    for (let round = 0; round < 20; round += 1) {
      await clean();
      const { payload } = await seed();
      const send = delivered();

      const results = await Promise.all([
        sendCampaign(payload, deps(send)),
        sendCampaign(payload, deps(send)),
      ]);

      expect(send).toHaveBeenCalledOnce();
      const statuses = results.map((result) => result.status).sort();
      expect(statuses.filter((status) => status === "sent")).toHaveLength(1);
      expect(["in-progress", "stale"]).toContain(statuses.find((status) => status !== "sent"));
    }
  }, 30_000);

  test("a retried job after an unknown outcome still sends nothing", async () => {
    const { payload } = await seed();
    const send = vi.fn().mockRejectedValue(new Error("connection reset"));

    await expect(sendCampaign(payload, deps(send))).rejects.toThrow();
    await sendCampaign(payload, deps(send));
    await sendCampaign(payload, deps(send));

    expect(send).toHaveBeenCalledOnce();
  });

  test("redelivered job after success sends nothing", async () => {
    const { payload } = await seed();
    const send = delivered();

    await sendCampaign(payload, deps(send));
    const again = await sendCampaign(payload, deps(send));

    expect(send).toHaveBeenCalledOnce();
    expect(again.status).toBe("stale");
  });

  test.each(["replied", "bounced", "unsubscribed", "completed"] as const)(
    "does not deliver to a %s assignment and keeps that state",
    async (status) => {
      const { payload, mailbox } = await seed();
      await admin
        .update(contactAssignments)
        .set({ status })
        .where(eq(contactAssignments.id, "assignment_send"));
      const send = delivered();

      const result = await sendCampaign(payload, deps(send));

      expect(result).toMatchObject({ status: "stopped", reason: "assignment" });
      expect(send).not.toHaveBeenCalled();
      expect((await assignment()).status).toBe(status);
      expect(await reservation()).toBeUndefined();
      expect((await mailboxRow(mailbox.id)).reservedSends).toBe(0);
    }
  );

  test("does not deliver for a paused campaign", async () => {
    const { payload, campaign } = await seed();
    await admin.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
    const send = delivered();

    const result = await sendCampaign(payload, deps(send));

    expect(result).toMatchObject({ status: "stopped", reason: "campaign" });
    expect(send).not.toHaveBeenCalled();
    expect(await reservation()).toBeUndefined();
  });

  test.each([
    ["disconnected", { status: "disconnected" as const }],
    ["ramp-paused", { rampStatus: "paused" as const }],
  ])("does not deliver from a %s mailbox", async (_name, change) => {
    const { payload, mailbox } = await seed();
    await admin.update(mailboxes).set(change).where(eq(mailboxes.id, mailbox.id));
    const send = delivered();

    const result = await sendCampaign(payload, deps(send));

    expect(result).toMatchObject({ status: "stopped", reason: "mailbox" });
    expect(send).not.toHaveBeenCalled();
  });

  test("outside the send window defers to the next window", async () => {
    const { payload, campaign } = await seed();
    await admin
      .update(campaigns)
      .set({
        schedule: {
          defaultTimezone: "UTC",
          daysAllowed: ["monday"],
          startTime: "09:00",
          endTime: "17:00",
        },
      })
      .where(eq(campaigns.id, campaign.id));
    const send = delivered();
    const saturday = Date.parse("2026-11-07T12:00:00.000Z");

    const result = await sendCampaign(payload, deps(send, { now: () => saturday }));

    expect(result.status).toBe("deferred");
    expect(send).not.toHaveBeenCalled();
    expect(await reservation()).toBeUndefined();
    expect((await assignment()).nextSendAt?.toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  test("a crash after the provider accepts never sends again", async () => {
    const { payload } = await seed();
    let accepted = false;
    const send = vi.fn(async () => {
      accepted = true;
      return { messageId: "<accepted@test>" };
    });

    await expect(
      sendCampaign(payload, deps(send, { failFinalize: () => accepted }))
    ).rejects.toThrow("database went away");
    const retry = await sendCampaign(payload, deps(send));

    expect(send).toHaveBeenCalledOnce();
    expect(retry.status).toBe("in-progress");
    expect((await reservation()).claimedAt).not.toBeNull();
  });

  test("a rate-limited mailbox gives the send back for dispatch to reassign", async () => {
    const { payload, mailbox } = await seed();
    const send = vi.fn().mockRejectedValue(new Error("429 too many requests"));

    await expect(sendCampaign(payload, deps(send))).rejects.toThrow("429");
    expect((await reservation()).claimedAt).toBeNull();
    const retry = await sendCampaign(payload, deps(send));

    expect(retry).toMatchObject({ status: "stopped", reason: "mailbox" });
    expect(send).toHaveBeenCalledOnce();
    expect(await reservation()).toBeUndefined();
    expect(await assignment()).toMatchObject({ currentStep: 0, status: "active" });
    expect(await mailboxRow(mailbox.id)).toMatchObject({ emailsSentToday: 0, reservedSends: 0 });
  });

  test("a permanent provider rejection stops without retrying", async () => {
    const { payload, mailbox } = await seed();
    const send = vi.fn().mockRejectedValue(new Error("535 invalid login"));

    const result = await sendCampaign(payload, deps(send));

    expect(result).toMatchObject({ status: "failed" });
    expect(send).toHaveBeenCalledOnce();
    expect(await reservation()).toBeUndefined();
    expect(await mailboxRow(mailbox.id)).toMatchObject({
      status: "disconnected",
      reservedSends: 0,
    });
  });

  test("an ambiguous provider failure is never retried", async () => {
    const { payload } = await seed();
    const send = vi.fn().mockRejectedValue(new Error("socket hang up"));

    await expect(sendCampaign(payload, deps(send))).rejects.toThrow("socket hang up");
    const retry = await sendCampaign(payload, deps(send));

    expect(send).toHaveBeenCalledOnce();
    expect(retry.status).toBe("in-progress");
  });

  test("a reply arriving during delivery is not overwritten", async () => {
    const { payload, mailbox } = await seed();
    const send = vi.fn(async () => {
      await admin
        .update(contactAssignments)
        .set({ status: "replied" })
        .where(eq(contactAssignments.id, "assignment_send"));
      return { messageId: "<in-flight@test>" };
    });

    const result = await sendCampaign(payload, deps(send));

    expect(result.status).toBe("sent");
    expect((await assignment()).status).toBe("replied");
    expect((await mailboxRow(mailbox.id)).emailsSentToday).toBe(1);
    const sent = await admin.select().from(threads).where(eq(threads.orgId, orgId));
    expect(sent).toHaveLength(1);
  });

  test("dispatch resolves an unknown outcome without sending again", async () => {
    const { mailbox } = await seed();
    await admin
      .update(sendReservations)
      .set({ claimedAt: new Date(), expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sendReservations.assignmentId, "assignment_send"));
    const jobs = { enqueueCampaignSend: vi.fn(async () => ({ jobId: "job" })) };

    await createWorkerDeps(jobs as unknown as JobQueue).dispatchDueSends();

    expect(jobs.enqueueCampaignSend).not.toHaveBeenCalled();
    expect(await reservation()).toBeUndefined();
    expect(await assignment()).toMatchObject({ currentStep: 1, status: "active" });
    expect(await mailboxRow(mailbox.id)).toMatchObject({ emailsSentToday: 1, reservedSends: 0 });
    const events = await admin
      .select()
      .from(emailEvents)
      .where(and(eq(emailEvents.orgId, orgId), inArray(emailEvents.type, ["failed"])));
    expect(events).toHaveLength(1);
  });

  test("dispatch skips work already reserved", async () => {
    await seed();
    const jobs = { enqueueCampaignSend: vi.fn(async () => ({ jobId: "job" })) };

    await createWorkerDeps(jobs as unknown as JobQueue).dispatchDueSends();

    expect(jobs.enqueueCampaignSend).not.toHaveBeenCalled();
  });
});
