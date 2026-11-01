import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDb } from "../../src/server/db/db";
import { blocklist } from "../../src/server/db/schema";
import { PostgresBlocklistRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;
const orgId = "org_blocklist";

describe.skipIf(!testUrl)("blocklist repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresBlocklistRepo(db);
  const rows = () => db.select().from(blocklist).where(eq(blocklist.orgId, orgId));

  beforeEach(async () => {
    await db.delete(blocklist).where(eq(blocklist.orgId, orgId));
  });

  test("whitespace and case cannot defeat suppression", async () => {
    await repo.add({ orgId, email: "  Person@Example.com ", reason: "manual" });

    await expect(repo.isBlocked("person@example.com", orgId)).resolves.toBe(true);
    await expect(repo.isBlocked(" PERSON@example.com\n", orgId)).resolves.toBe(true);
    expect(await rows()).toMatchObject([{ email: "person@example.com" }]);
  });

  test("a manual block can be removed by any spelling of the address", async () => {
    await repo.add({ orgId, email: "person@example.com", reason: "manual" });

    await expect(repo.remove(" Person@example.com ", orgId)).resolves.toBe("removed");
    await expect(repo.remove("person@example.com", orgId)).resolves.toBe("missing");
  });

  test("an opt-out cannot be removed by email or by id", async () => {
    await repo.add({ orgId, email: "person@example.com", reason: "unsubscribed" });
    const [row] = await rows();

    await expect(repo.remove("person@example.com", orgId)).resolves.toBe("opt-out");
    await expect(repo.removeById(row.id, orgId)).resolves.toBe("opt-out");
    await expect(repo.isBlocked("person@example.com", orgId)).resolves.toBe(true);
  });

  test("an unsubscribe upgrades an existing block so it can no longer be removed", async () => {
    await repo.add({ orgId, email: "person@example.com", reason: "manual" });
    await repo.add({ orgId, email: "person@example.com", reason: "unsubscribed" });

    expect(await rows()).toMatchObject([{ reason: "unsubscribed" }]);
    await expect(repo.remove("person@example.com", orgId)).resolves.toBe("opt-out");
  });

  test("a later manual block does not weaken an opt-out", async () => {
    await repo.add({ orgId, email: "person@example.com", reason: "unsubscribed" });
    await repo.add({ orgId, email: "person@example.com", reason: "manual" });

    expect(await rows()).toMatchObject([{ reason: "unsubscribed" }]);
  });

  test("removal is refused while any duplicate row records an opt-out", async () => {
    await db.insert(blocklist).values([
      { id: "block_a", orgId, email: "person@example.com", reason: "manual" },
      { id: "block_b", orgId, email: "person@example.com", reason: "unsubscribed" },
    ]);

    await expect(repo.removeById("block_a", orgId)).resolves.toBe("opt-out");
    expect(await rows()).toHaveLength(2);
  });

  test("removing by an unknown id reports it as missing", async () => {
    await expect(repo.removeById("block_none", orgId)).resolves.toBe("missing");
  });
});
