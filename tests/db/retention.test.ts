import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import { apiIdempotency, emailEvents, notifications } from "../../src/server/db/schema";
import { createWorkerDeps } from "../../src/server/worker/deps";

const adminUrl = process.env.TEST_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const orgs = ["org_retention_a", "org_retention_b"];
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

describe.skipIf(!adminUrl || !workerUrl)("retention on the worker database role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function clean() {
    await admin.delete(notifications).where(inArray(notifications.orgId, orgs));
    await admin.delete(emailEvents).where(inArray(emailEvents.orgId, orgs));
    await admin.delete(apiIdempotency).where(inArray(apiIdempotency.orgId, orgs));
  }

  async function seed(orgId: string) {
    await admin.insert(notifications).values([
      { id: `${orgId}_n_old`, orgId, type: "reply", title: "Old", createdAt: ago(91) },
      { id: `${orgId}_n_new`, orgId, type: "reply", title: "New", createdAt: ago(89) },
    ]);
    await admin.insert(emailEvents).values([
      {
        id: `${orgId}_e_old`,
        orgId,
        type: "sent",
        dedupeKey: `${orgId}_old`,
        occurredAt: ago(366),
      },
      {
        id: `${orgId}_e_new`,
        orgId,
        type: "sent",
        dedupeKey: `${orgId}_new`,
        occurredAt: ago(364),
      },
    ]);
    await admin.insert(apiIdempotency).values([
      {
        id: `${orgId}_i_old`,
        orgId,
        credentialId: "key",
        operationId: "op",
        key: "old",
        fingerprint: "f",
        expiresAt: ago(1),
      },
      {
        id: `${orgId}_i_new`,
        orgId,
        credentialId: "key",
        operationId: "op",
        key: "new",
        fingerprint: "f",
        expiresAt: new Date(Date.now() + DAY),
      },
    ]);
  }

  const remaining = async (orgId: string) => ({
    notifications: (
      await admin.select().from(notifications).where(eq(notifications.orgId, orgId))
    ).map((row) => row.id),
    events: (await admin.select().from(emailEvents).where(eq(emailEvents.orgId, orgId))).map(
      (row) => row.id
    ),
    idempotency: (
      await admin.select().from(apiIdempotency).where(eq(apiIdempotency.orgId, orgId))
    ).map((row) => row.id),
  });

  beforeEach(async () => {
    vi.stubEnv("WORKER_DATABASE_URL", workerUrl!);
    vi.stubEnv("DATABASE_DRIVER", "postgres-js");
    await clean();
  });

  afterEach(() => vi.unstubAllEnvs());
  afterAll(clean);

  test("removes only what has passed its retention, in every organization", async () => {
    await seed(orgs[0]);
    await seed(orgs[1]);

    await expect(createWorkerDeps().purgeExpired()).resolves.toMatchObject({
      status: "purged",
      failed: 0,
    });

    for (const orgId of orgs) {
      await expect(remaining(orgId)).resolves.toEqual({
        notifications: [`${orgId}_n_new`],
        events: [`${orgId}_e_new`],
        idempotency: [`${orgId}_i_new`],
      });
    }
  });

  test("a second run has nothing to do", async () => {
    await seed(orgs[0]);
    const deps = createWorkerDeps();
    await deps.purgeExpired();

    const second = await deps.purgeExpired();

    expect(second.failed).toBe(0);
    await expect(remaining(orgs[0])).resolves.toMatchObject({
      notifications: [`${orgs[0]}_n_new`],
    });
  });
});
