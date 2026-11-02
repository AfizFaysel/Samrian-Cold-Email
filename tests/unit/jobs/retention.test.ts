import { describe, expect, test, vi } from "vitest";

import { purgeExpired, type RetentionStore } from "../../../src/server/jobs/retention";

function store(overrides: Partial<RetentionStore> = {}): RetentionStore {
  return {
    listOrgs: vi.fn(async () => ["org_1"]),
    purgeBatch: vi.fn(async () => 0),
    ...overrides,
  };
}

const deps = (repo: RetentionStore) => ({
  now: () => Date.parse("2026-07-06T00:00:00.000Z"),
  system: <T>(operation: (repo: RetentionStore) => Promise<T>) => operation(repo),
  tenant: <T>(_orgId: string, operation: (repo: RetentionStore) => Promise<T>) => operation(repo),
});

describe("purgeExpired", () => {
  test("uses the documented retention windows", async () => {
    const repo = store();

    await purgeExpired(deps(repo));

    expect(repo.listOrgs).toHaveBeenCalledWith({
      notificationsBefore: new Date("2026-04-07T00:00:00.000Z"),
      eventsBefore: new Date("2025-07-06T00:00:00.000Z"),
      now: new Date("2026-07-06T00:00:00.000Z"),
    });
  });

  test("keeps deleting batches until an organization is clean", async () => {
    const purgeBatch = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValue(0);

    await expect(purgeExpired(deps(store({ purgeBatch })))).resolves.toEqual({
      status: "purged",
      orgs: 1,
      purged: 5,
      failed: 0,
    });
    expect(purgeBatch).toHaveBeenCalledTimes(3);
  });

  test("stops at the batch limit so one run stays bounded", async () => {
    const purgeBatch = vi.fn(async () => 1);

    await purgeExpired(deps(store({ purgeBatch })));

    expect(purgeBatch).toHaveBeenCalledTimes(20);
  });

  test("one organization failing does not stop the others", async () => {
    const purgeBatch = vi.fn().mockRejectedValueOnce(new Error("broken")).mockResolvedValue(0);

    await expect(
      purgeExpired(deps(store({ listOrgs: vi.fn(async () => ["org_1", "org_2"]), purgeBatch })))
    ).resolves.toMatchObject({ orgs: 2, failed: 1 });
    expect(purgeBatch).toHaveBeenCalledTimes(2);
  });
});
