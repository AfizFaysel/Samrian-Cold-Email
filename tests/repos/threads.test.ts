import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { threads } from "../../src/server/db/schema";
import { PostgresThreadRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres thread repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresThreadRepo(db);

  beforeEach(async () => {
    await db.delete(threads).where(eq(threads.orgId, "org_threads"));
  });

  test("inserts inbound thread idempotently by message id", async () => {
    const first = await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "reply_1",
      direction: "received",
      subject: "Re: Hi",
      receivedAt: 123,
      classification: "reply",
    });
    const second = await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "reply_1",
      direction: "received",
      subject: "Re: Hi again",
      receivedAt: 456,
      classification: "reply",
    });

    expect(second.id).toBe(first.id);
    await expect(repo.getByMessageId("reply_1", "org_threads")).resolves.toMatchObject({
      subject: "Re: Hi",
      classification: "reply",
    });
  });

  test("finds sent thread by references and provider thread id", async () => {
    await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "sent_1",
      providerThreadId: "provider_thread_1",
      direction: "sent",
      subject: "Hi",
      sentAt: 100,
    });

    await expect(
      repo.findSentForInbound({
        orgId: "org_threads",
        mailboxId: "mailbox_1",
        messageIds: ["missing", "sent_1"],
        providerThreadId: undefined,
      })
    ).resolves.toMatchObject({ messageId: "sent_1" });

    await expect(
      repo.findSentForInbound({
        orgId: "org_threads",
        mailboxId: "mailbox_1",
        messageIds: [],
        providerThreadId: "provider_thread_1",
      })
    ).resolves.toMatchObject({ messageId: "sent_1" });
  });

  test("matches message ids however they were stored, within one mailbox", async () => {
    await repo.insert({
      orgId: "org_threads",
      mailboxId: "mailbox_1",
      messageId: "<Sent_2@Example.com>",
      direction: "sent",
      subject: "Hi",
      sentAt: 100,
    });

    const find = (mailboxId: string) =>
      repo.findSentForInbound({
        orgId: "org_threads",
        mailboxId,
        messageIds: ["sent_2@example.com"],
      });

    await expect(find("mailbox_1")).resolves.toMatchObject({
      messageId: "<Sent_2@Example.com>",
    });
    await expect(find("mailbox_2")).resolves.toBeNull();
    await expect(
      repo.findSentForInbound({ orgId: "org_threads", mailboxId: "mailbox_1", messageIds: [] })
    ).resolves.toBeNull();
  });

  const received = (messageId: string, receivedAt: number) => ({
    orgId: "org_threads",
    mailboxId: "mailbox_1",
    messageId,
    direction: "received" as const,
    from: "lead@example.com",
    subject: "Re: Hi",
    receivedAt,
  });

  test("stores a received message once however many polls race", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => repo.insertReceived(received("reply_race", 100)))
    );

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
  });

  test("lists the newest replies when there are more than the limit", async () => {
    for (let index = 1; index <= 5; index += 1) {
      await repo.insertReceived(received(`reply_${index}`, index * 1000));
    }

    const page = await repo.listInbox({ orgId: "org_threads", userId: "user_1", limit: 2 });

    expect(page.map((thread) => thread.messageId)).toEqual(["reply_5", "reply_4"]);
  });

  test("counts unread replies beyond any page", async () => {
    for (let index = 1; index <= 3; index += 1) {
      await repo.insertReceived(received(`reply_${index}`, index));
    }

    await expect(repo.countUnreadInbox({ orgId: "org_threads", userId: "user_1" })).resolves.toBe(
      3
    );
  });

  test("preserves address fields and lists conversation oldest first", async () => {
    await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "sent_old",
      providerThreadId: "provider_thread_2",
      direction: "sent",
      from: "sender@example.com",
      to: ["lead@example.com"],
      subject: "Intro",
      sentAt: 100,
    });
    await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "reply_new",
      providerThreadId: "provider_thread_2",
      direction: "received",
      from: "lead@example.com",
      to: ["sender@example.com"],
      subject: "Re: Intro",
      receivedAt: 200,
    });

    await expect(
      repo.listConversation({
        orgId: "org_threads",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        providerThreadId: "provider_thread_2",
        limit: 10,
      })
    ).resolves.toMatchObject([
      { messageId: "sent_old", from: "sender@example.com", to: ["lead@example.com"] },
      { messageId: "reply_new", from: "lead@example.com", to: ["sender@example.com"] },
    ]);
  });

  test("preserves bounded provider attachment metadata", async () => {
    const inserted = await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "reply_attachment",
      direction: "received",
      from: "lead@example.com",
      to: ["sender@example.com"],
      subject: "Invoice",
      attachments: [
        {
          id: "attachment_1",
          filename: "invoice.pdf",
          size: 123,
          contentType: "application/pdf",
          inline: false,
        },
      ],
      providerUrl: "https://mail.google.com/mail/u/0/#inbox/thread_1",
      receivedAt: 200,
    });

    expect(inserted).toMatchObject({
      attachments: [{ id: "attachment_1", filename: "invoice.pdf", size: 123 }],
      providerUrl: "https://mail.google.com/mail/u/0/#inbox/thread_1",
    });
  });

  test("marks inbox threads read per user", async () => {
    const inbound = await repo.insert({
      orgId: "org_threads",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      messageId: "reply_unread",
      direction: "received",
      from: "lead@example.com",
      to: ["sender@example.com"],
      subject: "Re: Intro",
      receivedAt: 200,
    });

    await expect(repo.countUnreadInbox({ orgId: "org_threads", userId: "user_1" })).resolves.toBe(
      1
    );
    await repo.markRead({ orgId: "org_threads", userId: "user_1", threadId: inbound.id });
    await expect(repo.countUnreadInbox({ orgId: "org_threads", userId: "user_1" })).resolves.toBe(
      0
    );
    await expect(repo.countUnreadInbox({ orgId: "org_threads", userId: "user_2" })).resolves.toBe(
      1
    );
  });
});
