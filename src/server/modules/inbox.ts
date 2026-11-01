import type { ConnectorFactory } from "../jobs/types";
import type { JobRepos } from "../jobs/types";
import type { OrgId, ThreadRecord, UserId } from "../ports";
import { escapeHtml } from "./compliance";
import { buildEmailDisplay, getSafeEmailLinks, parseEmailSender } from "./email-display";
import { classifyMailboxError, provedNotDelivered } from "./mailboxes";
import { getProviderPolicy } from "./providers";
import { getMailboxCapacity } from "./ramp";

export type SendReplyInput = {
  orgId: OrgId;
  userId: UserId;
  threadId: string;
  body: string;
  subject?: string;
  clientRequestId: string;
};

export type SendReplyDeps = {
  repos?: Pick<JobRepos, "mailboxes" | "threads">;
  connectorForMailbox: ConnectorFactory;
  now: () => number;
  transaction?: <T>(
    operation: (repos: NonNullable<SendReplyDeps["repos"]>) => Promise<T>
  ) => Promise<T>;
};

export type SendReplyResult = {
  status: "sent" | "duplicate";
  threadId?: string;
  messageId?: string;
};

const REPLY_UNKNOWN = "manual-reply-unknown";

export async function listInbox(
  input: { orgId: OrgId; userId: UserId; limit?: number },
  deps: { repos: NonNullable<SendReplyDeps["repos"]> }
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const [threads, unreadCount] = await Promise.all([
    deps.repos.threads.listInbox({ orgId: input.orgId, userId: input.userId, limit }),
    deps.repos.threads.countUnreadInbox({ orgId: input.orgId, userId: input.userId }),
  ]);

  return {
    threads: threads.map(toInboxRecord),
    unreadCount,
  };
}

export async function getThread(
  input: { orgId: OrgId; userId: UserId; threadId: string; limit?: number },
  deps: { repos: NonNullable<SendReplyDeps["repos"]> }
) {
  const thread = await deps.repos.threads.getById(input.threadId, input.orgId);
  if (!thread) throw new Error("Thread not found");
  const messages = await getConversation(thread, {
    repos: deps.repos,
  });

  return {
    thread: toInboxRecord(thread),
    messages: messages.slice(0, Math.min(Math.max(input.limit ?? 200, 1), 500)).map(toInboxRecord),
  };
}

export async function markThreadRead(
  input: { orgId: OrgId; userId: UserId; threadId: string; read?: boolean },
  deps: { repos: NonNullable<SendReplyDeps["repos"]> }
) {
  if (input.read === false) return { success: true };
  await deps.repos.threads.markRead({
    orgId: input.orgId,
    userId: input.userId,
    threadId: input.threadId,
  });
  return { success: true };
}

export async function sendReply(
  input: SendReplyInput,
  deps: SendReplyDeps
): Promise<SendReplyResult> {
  const body = input.body.trim();
  if (!body) throw new Error("Reply body is required");
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Inbox repositories are not configured");
      return operation(deps.repos);
    });

  const html = escapeHtml(body).replace(/\r?\n/g, "<br>");

  // The claim commits before delivery, so a retry or a racing request can never send again.
  const prepared = await run(async (repos) => {
    const existing = await repos.threads.findByClientRequestId?.(
      input.clientRequestId,
      input.orgId
    );
    if (existing) return { existing } as const;

    const thread = await repos.threads.getById(input.threadId, input.orgId);
    if (!thread || thread.direction !== "received") throw new Error("Thread not found");
    if (!thread.mailboxId) throw new Error("Thread mailbox not found");

    const mailbox = await repos.mailboxes.getById(thread.mailboxId, input.orgId);
    if (!mailbox) throw new Error("Mailbox not found");
    const conversation = (await repos.threads.listConversation?.({
      orgId: thread.orgId,
      campaignId: thread.campaignId,
      contactId: thread.contactId,
      mailboxId: thread.mailboxId,
      providerThreadId: thread.providerThreadId,
      limit: 200,
    })) ?? [thread];

    if (
      mailbox.archivedAt ||
      mailbox.status === "disconnected" ||
      mailbox.status === "limit_reached"
    ) {
      throw new Error("Mailbox is not available");
    }
    const recipient = getReplyRecipient(thread);
    if (!recipient) throw new Error("Reply recipient not found");

    const dailyLimit = mailbox.dailySendLimit ?? Number.MAX_SAFE_INTEGER;
    const { effectiveLimit } = getMailboxCapacity({
      providerLimit: mailbox.provider
        ? getProviderPolicy(mailbox.provider).maxSafeDailyLimit
        : dailyLimit,
      userLimit: dailyLimit,
      rampEnabled: mailbox.rampEnabled,
      rampLimit: mailbox.rampCurrentLimit,
      sentToday: mailbox.sentToday,
      reserved: mailbox.reservedSends,
    });
    if (!(await repos.mailboxes.claimReplySend(mailbox.id, input.orgId, effectiveLimit))) {
      throw new Error("Mailbox daily capacity reached");
    }

    const latest = conversation.at(-1) ?? thread;
    const inReplyTo = getMessageId(latest) ?? getMessageId(thread);
    const references = mergeReferences(latest.references ?? thread.references, inReplyTo);
    const subject = input.subject?.trim() || toReplySubject(thread.subject);

    const claim = await repos.threads.claimReply({
      orgId: input.orgId,
      campaignId: thread.campaignId,
      contactId: thread.contactId,
      mailboxId: thread.mailboxId,
      messageId: `pending:${input.clientRequestId}`,
      clientRequestId: input.clientRequestId,
      inReplyTo,
      references,
      providerThreadId: thread.providerThreadId,
      classification: "manual-reply-pending",
      direction: "sent",
      from: mailbox.email,
      to: [recipient],
      subject,
      textBody: body,
      htmlBody: html,
      headers: {},
      sentAt: deps.now(),
    });
    if (!claim) {
      await repos.mailboxes.refundReplySend(mailbox.id, input.orgId);
      const winner = await repos.threads.findByClientRequestId?.(
        input.clientRequestId,
        input.orgId
      );
      return { existing: winner ?? thread } as const;
    }

    return { thread, mailbox, claim, recipient, subject, inReplyTo, references } as const;
  });
  if (prepared.existing) {
    if (prepared.existing.classification === REPLY_UNKNOWN) {
      throw new Error("Earlier delivery of this reply could not be confirmed");
    }
    return {
      status: "duplicate",
      threadId: prepared.existing.id,
      messageId: prepared.existing.messageId,
    };
  }

  const { thread, mailbox, claim, recipient, subject, inReplyTo, references } = prepared;
  const release = () =>
    run(async (repos) => {
      await repos.threads.releaseReply(claim.id, input.orgId);
      await repos.mailboxes.refundReplySend(mailbox.id, input.orgId);
    });

  const connector = await deps.connectorForMailbox(mailbox).catch(async (error: unknown) => {
    await release();
    throw error;
  });
  try {
    const result = await connector.send({
      from: mailbox.email,
      to: recipient,
      subject,
      text: body,
      html,
      inReplyTo,
      references,
      providerThreadId: thread.providerThreadId,
    });

    await run((repos) =>
      repos.threads.updateReply(claim.id, input.orgId, {
        messageId: result.messageId,
        providerThreadId: result.providerThreadId,
        classification: "manual-reply",
      })
    );

    return { status: "sent", threadId: claim.id, messageId: result.messageId };
  } catch (error) {
    if (provedNotDelivered(classifyMailboxError(error))) {
      await release();
    } else {
      await run((repos) =>
        repos.threads.updateReply(claim.id, input.orgId, { classification: REPLY_UNKNOWN })
      );
    }
    throw error;
  } finally {
    await connector.close();
  }
}

async function getConversation(
  thread: ThreadRecord,
  deps: { repos: NonNullable<SendReplyDeps["repos"]> }
): Promise<ThreadRecord[]> {
  return (
    (await deps.repos.threads.listConversation?.({
      orgId: thread.orgId,
      campaignId: thread.campaignId,
      contactId: thread.contactId,
      mailboxId: thread.mailboxId,
      providerThreadId: thread.providerThreadId,
      limit: 200,
    })) ?? [thread]
  );
}

function getReplyRecipient(thread: ThreadRecord): string | undefined {
  return (
    firstEmail(thread.from) ??
    firstEmail(thread.headers?.From) ??
    firstEmail(thread.rawHeaders?.From)
  );
}

function getMessageId(thread: ThreadRecord): string | undefined {
  return thread.messageId ?? thread.headers?.["Message-ID"] ?? thread.headers?.["Message-Id"];
}

function mergeReferences(
  references: string[] | undefined,
  inReplyTo: string | undefined
): string[] {
  const values = [...(references ?? []), ...(inReplyTo ? [inReplyTo] : [])];
  return Array.from(new Set(values.filter(Boolean)));
}

function toReplySubject(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function firstEmail(value?: string): string | undefined {
  return value?.match(/[^\s<>,;]+@[^\s<>,;]+/)?.[0]?.toLowerCase();
}

function toInboxRecord(thread: ThreadRecord & { unread?: boolean }) {
  const display = buildEmailDisplay({
    textBody: thread.textBody,
    htmlBody: thread.htmlBody,
  });

  return {
    id: thread.id,
    orgId: thread.orgId,
    campaignId: thread.campaignId,
    contactId: thread.contactId,
    mailboxId: thread.mailboxId,
    direction: thread.direction,
    classification: thread.classification,
    from: thread.from,
    to: thread.to,
    subject: thread.subject,
    attachments: thread.attachments,
    sentAt: thread.sentAt,
    receivedAt: thread.receivedAt,
    unread: thread.unread,
    displayText: display.text,
    excerpt: display.excerpt,
    sender: parseEmailSender(thread.from),
    links: getSafeEmailLinks(display.text),
  };
}
