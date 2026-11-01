import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { mailboxes } from "../../src/server/db/schema";
import { PostgresMailboxRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;
const orgId = "org_reconnect";

describe.skipIf(!testUrl)("mailbox OAuth reconnect", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresMailboxRepo(db);

  const create = () =>
    repo.create({
      orgId,
      name: "Sender",
      provider: "google",
      userEmail: "sender@example.com",
      dailySendLimit: 50,
      encryptedRefreshToken: "old-token",
    });

  beforeEach(async () => {
    await db.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
  });

  test("replaces tokens on a matching mailbox and clears connection errors", async () => {
    const mailbox = await create();
    await db
      .update(mailboxes)
      .set({ status: "disconnected", lastConnectionError: "expired" })
      .where(eq(mailboxes.id, mailbox.id));

    const updated = await repo.reconnectOAuth(mailbox.id, orgId, "google", {
      encryptedRefreshToken: "new-token",
    });

    const row = await repo.getRawById(mailbox.id, orgId);
    expect(updated).toBe(true);
    expect(row?.encryptedRefreshToken).toBe("new-token");
    expect(row?.status).toBe("active");
    expect(row?.lastConnectionError).toBeNull();
  });

  test("leaves a mailbox from another provider untouched", async () => {
    const mailbox = await create();

    const updated = await repo.reconnectOAuth(mailbox.id, orgId, "microsoft", {
      encryptedRefreshToken: "wrong-token",
    });

    const row = await repo.getRawById(mailbox.id, orgId);
    expect(updated).toBe(false);
    expect(row?.encryptedRefreshToken).toBe("old-token");
  });

  test("leaves a mailbox in another org untouched", async () => {
    const mailbox = await create();

    const updated = await repo.reconnectOAuth(mailbox.id, "org_other", "google", {
      encryptedRefreshToken: "wrong-token",
    });

    const row = await repo.getRawById(mailbox.id, orgId);
    expect(updated).toBe(false);
    expect(row?.encryptedRefreshToken).toBe("old-token");
  });

  test("does not revive an archived mailbox", async () => {
    const mailbox = await create();
    await db.update(mailboxes).set({ archivedAt: new Date() }).where(eq(mailboxes.id, mailbox.id));

    const updated = await repo.reconnectOAuth(mailbox.id, orgId, "google", {
      encryptedRefreshToken: "new-token",
    });

    expect(updated).toBe(false);
  });
});
