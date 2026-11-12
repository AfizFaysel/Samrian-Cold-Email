import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import { mailboxes, sendReservations } from "../../src/server/db/schema";
import { PostgresMailboxRepo } from "../../src/server/repos";
import { createWorkerDeps } from "../../src/server/worker/deps";

const adminUrl = process.env.TEST_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const orgId = "org_reset";

describe.skipIf(!adminUrl || !workerUrl)("daily reset on the worker database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(sendReservations).where(eq(sendReservations.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
  }

  async function seed(input: { sent: number; reserved: number; live: number }) {
    const mailbox = await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit: 50,
    });
    await admin
      .update(mailboxes)
      .set({ emailsSentToday: input.sent, reservedSends: input.reserved })
      .where(eq(mailboxes.id, mailbox.id));
    for (let index = 0; index < input.live; index += 1) {
      await admin.insert(sendReservations).values({
        id: `reservation_${index}`,
        orgId,
        mailboxId: mailbox.id,
        assignmentId: `assignment_${index}`,
        stepNumber: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });
    }
    return mailbox.id;
  }

  const counters = async (id: string) => {
    const [row] = await admin.select().from(mailboxes).where(eq(mailboxes.id, id));
    return { sent: row.emailsSentToday, reserved: row.reservedSends };
  };

  beforeEach(async () => {
    vi.stubEnv("WORKER_DATABASE_URL", workerUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("clears sent counts and keeps capacity held by live reservations", async () => {
    const id = await seed({ sent: 10, reserved: 3, live: 2 });

    await createWorkerDeps().resetCounters();

    expect(await counters(id)).toEqual({ sent: 0, reserved: 2 });
  });

  test("running twice in one day keeps sends counted after the first run", async () => {
    const id = await seed({ sent: 10, reserved: 0, live: 0 });
    await createWorkerDeps().resetCounters();
    await admin.update(mailboxes).set({ emailsSentToday: 4 }).where(eq(mailboxes.id, id));

    await createWorkerDeps().resetCounters();

    expect((await counters(id)).sent).toBe(4);
  });

  test("resets again on the next day", async () => {
    const id = await seed({ sent: 10, reserved: 0, live: 0 });
    await admin.update(mailboxes).set({ countersDay: "2026-01-01" }).where(eq(mailboxes.id, id));

    await createWorkerDeps().resetCounters();

    expect((await counters(id)).sent).toBe(0);
  });

  // Kiritimati runs 25 hours ahead of Pago Pago, so the two are never on the same date.
  test("resets each mailbox when its own local day starts", async () => {
    const pagoDay = localDate("Pacific/Pago_Pago");
    const behind = await seed({ sent: 10, reserved: 0, live: 0 });
    const ahead = await seed({ sent: 10, reserved: 0, live: 0 });
    await admin
      .update(mailboxes)
      .set({ countersDay: pagoDay, timezone: "Pacific/Pago_Pago" })
      .where(eq(mailboxes.id, behind));
    await admin
      .update(mailboxes)
      .set({ countersDay: pagoDay, timezone: "Pacific/Kiritimati" })
      .where(eq(mailboxes.id, ahead));

    await createWorkerDeps().resetCounters();

    expect((await counters(behind)).sent).toBe(10);
    expect((await counters(ahead)).sent).toBe(0);
  });
});

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
