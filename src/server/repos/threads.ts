import { and, asc, count, desc, eq, inArray, notExists, or, sql } from "drizzle-orm";

import { threadReads, threads } from "../db/schema";
import { normalizeMessageId } from "../modules/inbound";
import type { DbExecutor } from "../db/tx";
import type { InboxThreadRecord, InsertThreadInput, OrgId, ThreadId, ThreadRecord } from "../ports";
import { newId } from "./ids";

export class PostgresThreadRepo {
  constructor(private readonly db: DbExecutor) {}

  async getById(id: ThreadId, orgId: OrgId): Promise<ThreadRecord | null> {
    const [row] = await this.db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.orgId, orgId)))
      .limit(1);
    return row ? toThread(row) : null;
  }

  async getByMessageId(messageId: string, orgId: OrgId): Promise<ThreadRecord | null> {
    const [row] = await this.db
      .select()
      .from(threads)
      .where(and(eq(threads.messageId, messageId), eq(threads.orgId, orgId)))
      .limit(1);
    return row ? toThread(row) : null;
  }

  async findByClientRequestId(clientRequestId: string, orgId: OrgId): Promise<ThreadRecord | null> {
    const [row] = await this.db
      .select()
      .from(threads)
      .where(and(eq(threads.clientRequestId, clientRequestId), eq(threads.orgId, orgId)))
      .limit(1);
    return row ? toThread(row) : null;
  }

  async listConversation(input: {
    orgId: OrgId;
    campaignId?: string;
    contactId?: string;
    mailboxId?: string;
    providerThreadId?: string;
    limit: number;
  }): Promise<ThreadRecord[]> {
    const filters = [eq(threads.orgId, input.orgId)];
    if (input.campaignId) filters.push(eq(threads.campaignId, input.campaignId));
    if (input.contactId) filters.push(eq(threads.contactId, input.contactId));
    if (input.mailboxId) filters.push(eq(threads.mailboxId, input.mailboxId));
    if (input.providerThreadId) filters.push(eq(threads.providerThreadId, input.providerThreadId));

    const rows = await this.db
      .select()
      .from(threads)
      .where(and(...filters))
      .orderBy(asc(threads.createdAt))
      .limit(input.limit);

    return rows.map(toThread).sort((a, b) => threadTime(a) - threadTime(b));
  }

  async listInbox(input: {
    orgId: OrgId;
    userId: string;
    limit: number;
  }): Promise<InboxThreadRecord[]> {
    const rows = await this.db
      .select()
      .from(threads)
      .where(and(eq(threads.orgId, input.orgId), eq(threads.direction, "received")))
      .orderBy(desc(sql`coalesce(${threads.receivedAt}, ${threads.createdAt})`), desc(threads.id))
      .limit(input.limit);

    const records = rows.map(toThread);
    const readIds = await this.getReadIds(
      input.orgId,
      input.userId,
      records.map((row) => row.id)
    );
    return records.map((record) => ({ ...record, unread: !readIds.has(record.id) }));
  }

  async countUnreadInbox(input: { orgId: OrgId; userId: string }): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(threads)
      .where(
        and(
          eq(threads.orgId, input.orgId),
          eq(threads.direction, "received"),
          notExists(
            this.db
              .select({ id: threadReads.id })
              .from(threadReads)
              .where(
                and(
                  eq(threadReads.orgId, threads.orgId),
                  eq(threadReads.userId, input.userId),
                  eq(threadReads.threadId, threads.id)
                )
              )
          )
        )
      );
    return row?.value ?? 0;
  }

  private async getReadIds(
    orgId: OrgId,
    userId: string,
    threadIds: ThreadId[]
  ): Promise<Set<string>> {
    if (threadIds.length === 0) return new Set();

    const readRows = await this.db
      .select({ threadId: threadReads.threadId })
      .from(threadReads)
      .where(
        and(
          eq(threadReads.orgId, orgId),
          eq(threadReads.userId, userId),
          inArray(threadReads.threadId, threadIds)
        )
      );
    return new Set(readRows.map((row) => row.threadId));
  }

  async markRead(input: {
    orgId: OrgId;
    userId: string;
    threadId: ThreadId;
    at?: number;
  }): Promise<void> {
    const existing = await this.db
      .select({ id: threadReads.id })
      .from(threadReads)
      .where(
        and(
          eq(threadReads.orgId, input.orgId),
          eq(threadReads.userId, input.userId),
          eq(threadReads.threadId, input.threadId)
        )
      )
      .limit(1);

    if (existing[0]) return;

    await this.db.insert(threadReads).values({
      id: newId("thread_read"),
      orgId: input.orgId,
      userId: input.userId,
      threadId: input.threadId,
      readAt: new Date(input.at ?? Date.now()),
    });
  }

  async findSentForInbound(input: {
    orgId: OrgId;
    mailboxId: string;
    messageIds: string[];
    providerThreadId?: string;
  }): Promise<ThreadRecord | null> {
    const ids = [...new Set(input.messageIds.map(normalizeMessageId).filter(Boolean))];
    const matches = [
      ...(ids.length > 0 ? [inArray(sql`lower(btrim(${threads.messageId}, '<> '))`, ids)] : []),
      ...(input.providerThreadId ? [eq(threads.providerThreadId, input.providerThreadId)] : []),
    ];
    if (matches.length === 0) return null;

    const [row] = await this.db
      .select()
      .from(threads)
      .where(
        and(
          eq(threads.orgId, input.orgId),
          eq(threads.mailboxId, input.mailboxId),
          eq(threads.direction, "sent"),
          or(...matches)
        )
      )
      .orderBy(desc(threads.sentAt), desc(threads.id))
      .limit(1);

    return row ? toThread(row) : null;
  }

  // The unique index decides between concurrent polls, so only one runs the side effects.
  async insertReceived(input: InsertThreadInput): Promise<ThreadRecord & { created: boolean }> {
    const [row] = await this.db
      .insert(threads)
      .values(toRow({ ...input, direction: "received" }))
      .onConflictDoNothing()
      .returning();
    if (row) return { ...toThread(row), created: true };

    const [existing] = await this.db
      .select()
      .from(threads)
      .where(
        and(
          eq(threads.orgId, input.orgId),
          eq(threads.messageId, input.messageId ?? ""),
          eq(threads.direction, "received")
        )
      )
      .limit(1);
    return { ...toThread(existing), created: false };
  }

  async insert(input: InsertThreadInput): Promise<ThreadRecord> {
    if (input.messageId) {
      const existing = await this.getByMessageId(input.messageId, input.orgId);
      if (existing) return existing;
    }

    const [row] = await this.db.insert(threads).values(toRow(input)).returning();

    return toThread(row);
  }
}

function toRow(input: InsertThreadInput) {
  return {
    id: newId("thread"),
    orgId: input.orgId,
    campaignId: input.campaignId ?? "",
    contactId: input.contactId ?? "",
    mailboxId: input.mailboxId ?? "",
    messageId: input.messageId ?? newId("message"),
    providerMessageId: input.providerMessageId,
    clientRequestId: input.clientRequestId,
    inReplyTo: input.inReplyTo,
    references: input.references,
    providerThreadId: input.providerThreadId,
    classification: input.classification,
    processedAt: input.processedAt ? new Date(input.processedAt) : undefined,
    rawHeaders: input.rawHeaders,
    direction: input.direction ?? "sent",
    from: input.from ?? "",
    to: input.to ?? [],
    subject: input.subject,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    headers: input.headers ?? {},
    attachments: input.attachments,
    providerUrl: input.providerUrl,
    sentAt: input.sentAt ? new Date(input.sentAt) : undefined,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
  };
}

function toThread(row: typeof threads.$inferSelect): ThreadRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    campaignId: row.campaignId,
    contactId: row.contactId,
    mailboxId: row.mailboxId,
    messageId: row.messageId,
    providerMessageId: row.providerMessageId ?? undefined,
    clientRequestId: row.clientRequestId ?? undefined,
    inReplyTo: row.inReplyTo ?? undefined,
    references: asStringArray(row.references),
    providerThreadId: row.providerThreadId ?? undefined,
    classification: row.classification ?? undefined,
    processedAt: row.processedAt?.getTime(),
    rawHeaders: asHeaders(row.rawHeaders),
    direction: row.direction,
    from: row.from,
    to: asStringArray(row.to) ?? [],
    subject: row.subject,
    textBody: row.textBody ?? undefined,
    htmlBody: row.htmlBody ?? undefined,
    headers: asHeaders(row.headers),
    attachments: asAttachments(row.attachments),
    providerUrl: row.providerUrl ?? undefined,
    sentAt: row.sentAt?.getTime(),
    receivedAt: row.receivedAt?.getTime(),
  };
}

function asAttachments(value: unknown): ThreadRecord["attachments"] {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is NonNullable<ThreadRecord["attachments"]>[number] =>
    Boolean(
      item &&
      typeof item === "object" &&
      "id" in item &&
      typeof item.id === "string" &&
      "filename" in item &&
      typeof item.filename === "string" &&
      "size" in item &&
      typeof item.size === "number" &&
      "inline" in item &&
      typeof item.inline === "boolean"
    )
  );
}

function threadTime(thread: ThreadRecord): number {
  return thread.receivedAt ?? thread.sentAt ?? 0;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function asHeaders(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
}
