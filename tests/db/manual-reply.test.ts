import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createDb } from "../../src/server/db/db";
import { mailboxes, threads } from "../../src/server/db/schema";
import { withTenant } from "../../src/server/db/tenant";
import { sendReply } from "../../src/server/modules/inbox";
import { createPostgresJobRepos, PostgresMailboxRepo } from "../../src/server/repos";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const orgId = "org_reply";

describe.skipIf(!adminUrl || !appUrl)("manual reply claim on the app role", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const app = createDb({ driver: "postgres-js", url: appUrl! }).client;

  async function clean() {
    await admin.delete(threads).where(eq(threads.orgId, orgId));
    await admin.delete(mailboxes).where(eq(mailboxes.orgId, orgId));
  }

  async function seed(dailySendLimit: number) {
    const mailbox = await new PostgresMailboxRepo(admin).create({
      orgId,
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit,
    });
    await admin.insert(threads).values({
      id: "thread_reply",
      orgId,
      campaignId: "",
      contactId: "",
      mailboxId: mailbox.id,
      messageId: "<reply@example.com>",
      direction: "received",
      from: "lead@example.com",
      to: ["sender@example.com"],
      subject: "Hi",
      receivedAt: new Date(),
    });
    return mailbox;
  }

  const reply = (clientRequestId: string, send: ReturnType<typeof vi.fn>) =>
    sendReply(
      { orgId, userId: "user_1", threadId: "thread_reply", body: "Thanks", clientRequestId },
      {
        transaction: (operation) =>
          withTenant(app, { orgId, actorType: "request" }, (tx) => {
            const repos = createPostgresJobRepos(tx);
            return operation({ mailboxes: repos.mailboxes, threads: repos.threads });
          }),
        connectorForMailbox: async () => ({ send, close: async () => undefined }) as never,
        now: Date.now,
      }
    );

  const delivered = () =>
    vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { messageId: `<${crypto.randomUUID()}@test>`, accepted: [], rejected: [] };
    });

  beforeEach(clean);
  afterAll(clean);

  test("one request ID sends once however many requests race", async () => {
    await seed(50);
    const send = delivered();

    const results = await Promise.all(Array.from({ length: 6 }, () => reply("same_request", send)));

    expect(send).toHaveBeenCalledOnce();
    expect(results.filter((result) => result.status === "sent")).toHaveLength(1);
    const [mailbox] = await admin.select().from(mailboxes).where(eq(mailboxes.orgId, orgId));
    expect(mailbox.emailsSentToday).toBe(1);
  });

  test("the last capacity slot goes to exactly one reply", async () => {
    await seed(1);
    const send = delivered();

    const results = await Promise.allSettled([reply("a", send), reply("b", send)]);

    expect(send).toHaveBeenCalledOnce();
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("a retry after an uncertain failure never sends again", async () => {
    await seed(50);
    const send = vi.fn(async () => {
      throw new Error("socket hang up");
    });

    await expect(reply("uncertain", send)).rejects.toThrow("socket hang up");
    await expect(reply("uncertain", send)).rejects.toThrow("could not be confirmed");

    expect(send).toHaveBeenCalledOnce();
  });

  test("a clear refusal releases the claim so the reply can be retried", async () => {
    const mailbox = await seed(50);
    const refused = vi.fn(async () => {
      throw new Error("rate limit exceeded");
    });

    await expect(reply("refused", refused)).rejects.toThrow("rate limit");
    await expect(reply("refused", delivered())).resolves.toMatchObject({ status: "sent" });

    const [row] = await admin.select().from(mailboxes).where(eq(mailboxes.id, mailbox.id));
    expect(row.emailsSentToday).toBe(1);
  });
});
