/**
 * SmtpImapConnector — provider-managed mailboxes (puzzle / mailpool)
 *
 * Send:  Nodemailer + SMTP, STARTTLS enforced on port 587
 * Poll:  ImapFlow, fetches UNSEEN messages. Caller marks as SEEN after DB work.
 */

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import type {
  MailboxConnector,
  MailboxRecord,
  SmtpImapCredentials,
  SendOptions,
  SendResult,
  RawMessage,
  PollOptions,
  ConnectionTestResult,
} from "./types";
import { MailboxConnectionError } from "./errors";
import { logger } from "../../src/server/observability/runtime";
import { resolveOutboundHost, type OutboundHost } from "../../src/server/network/outbound";

type HostResolver = (host: string) => Promise<OutboundHost>;

const connectionTimeout = 10_000;
const socketTimeout = 60_000;
const maxPollMessages = 50;
const maxMessageBytes = 1024 * 1024;
const maxBodyParts = 100;

type BodyNode = {
  part?: string;
  type?: string;
  disposition?: string;
  childNodes?: BodyNode[];
};

export class SmtpImapConnector implements MailboxConnector {
  private imap: ImapFlow | null = null;

  constructor(
    private readonly mailbox: MailboxRecord,
    private readonly creds: SmtpImapCredentials,
    private readonly resolveHost: HostResolver = (host) =>
      resolveOutboundHost(host, {
        allowPrivate: process.env.OUTBOUND_ALLOW_PRIVATE_EMAIL_HOSTS === "true",
      })
  ) {}

  // ── Send ────────────────────────────────────────────────────────────────────

  async send(message: SendOptions): Promise<SendResult> {
    const { smtpHost, smtpPort, username } = this.mailbox;

    if (!smtpHost || !smtpPort || !username) {
      throw new MailboxConnectionError("Missing SMTP configuration", this.mailbox.provider);
    }

    // Enforce TLS on supported ports (587 STARTTLS, 465 Implicit TLS)
    if (smtpPort !== 587 && smtpPort !== 465) {
      throw new MailboxConnectionError(
        `SMTP port must be 587 (STARTTLS) or 465 (Implicit TLS). Got: ${smtpPort}`,
        this.mailbox.provider
      );
    }

    const endpoint = await this.resolveHost(smtpHost);
    const isImplicitTls = smtpPort === 465;
    const transport = nodemailer.createTransport({
      host: endpoint.address,
      port: smtpPort,
      secure: isImplicitTls, // true for 465, false for 587 (STARTTLS)
      requireTLS: true, // Reject if server doesn't support TLS/STARTTLS
      auth: { user: username, pass: this.creds.password },
      connectionTimeout,
      greetingTimeout: connectionTimeout,
      socketTimeout,
      dnsTimeout: 5_000,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        servername: endpoint.servername,
      },
    });

    const info = await transport.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      ...(message.inReplyTo && { inReplyTo: message.inReplyTo }),
      ...(message.references?.length && {
        references: message.references.join(" "),
      }),
    });

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  }

  // ── Poll ────────────────────────────────────────────────────────────────────

  async pollNewMessages(options?: PollOptions): Promise<RawMessage[]> {
    const { imapHost, imapPort, username } = this.mailbox;

    if (!imapHost || !imapPort || !username) {
      throw new MailboxConnectionError("Missing IMAP configuration", this.mailbox.provider);
    }
    if (imapPort !== 993 && imapPort !== 143) {
      throw new MailboxConnectionError(
        `IMAP port must be 993 (Implicit TLS) or 143 (STARTTLS). Got: ${imapPort}`,
        this.mailbox.provider
      );
    }

    const endpoint = await this.resolveHost(imapHost);
    const client = new ImapFlow({
      host: endpoint.address,
      port: imapPort,
      secure: imapPort === 993,
      doSTARTTLS: imapPort !== 993,
      servername: endpoint.servername,
      auth: { user: username, pass: this.creds.password },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectionTimeout,
      greetingTimeout: connectionTimeout,
      socketTimeout,
      logger: false,
    });

    this.imap = client;
    const messages: RawMessage[] = [];

    try {
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");
      try {
        const unseen = await client.search(
          { seen: false, ...(options?.since ? { since: new Date(options.since) } : {}) },
          { uid: true }
        );
        const uids = unseen ? unseen.slice(-maxPollMessages) : [];
        const fetched: Array<{ raw: string; uid: number; envelope: unknown; nodes: BodyNode[] }> =
          [];
        for await (const msg of client.fetch(
          uids,
          {
            uid: true,
            envelope: true,
            bodyStructure: true,
            source: { start: 0, maxLength: maxMessageBytes },
            flags: true,
          },
          { uid: true }
        )) {
          fetched.push({
            raw: msg.source?.toString() ?? "",
            uid: msg.uid,
            envelope: msg.envelope,
            nodes: flattenBody(msg.bodyStructure as BodyNode | undefined),
          });
        }

        // Commands cannot run during a fetch, so bodies are read once it has finished.
        for (const { raw, uid, envelope, nodes } of fetched) {
          try {
            const text = await readPart(client, uid, findPart(nodes, "text/plain"));
            const report = await readPart(client, uid, findPart(nodes, "message/delivery-status"));
            const html = await readPart(client, uid, findPart(nodes, "text/html"));
            messages.push({
              ...parseRawEmail(raw, { envelope, uid }),
              textBody: [text, report].filter(Boolean).join("\n") || undefined,
              htmlBody: html,
              partMimeTypes: nodes.flatMap((node) => (node.type ? [node.type] : [])),
            });
          } catch {
            // Left unread, so the rescan window retries it without blocking later mail.
            logger.warn("mailbox.imap_body_failed", { uid });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
      this.imap = null;
    }

    return messages;
  }

  async markMessageProcessed(message: RawMessage): Promise<void> {
    const { imapHost, imapPort, username } = this.mailbox;
    const uid = Number(message.providerMessageId);

    if (!imapHost || !imapPort || !username || !Number.isFinite(uid)) return;
    if (imapPort !== 993 && imapPort !== 143) return;

    const endpoint = await this.resolveHost(imapHost);
    const client = new ImapFlow({
      host: endpoint.address,
      port: imapPort,
      secure: imapPort === 993,
      doSTARTTLS: imapPort !== 993,
      servername: endpoint.servername,
      auth: { user: username, pass: this.creds.password },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectionTimeout,
      greetingTimeout: connectionTimeout,
      socketTimeout,
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  // ── Reply ───────────────────────────────────────────────────────────────────

  async replyToThread(threadId: string, html: string): Promise<void> {
    // threadId is the original Message-ID; build reply headers
    await this.send({
      from: this.mailbox.userEmail ?? this.mailbox.username ?? "",
      to: threadId, // caller should pass the recipient address, not the message-id
      subject: "", // caller should set subject via SendOptions — this overload is a convenience
      html,
      text: html.replace(/<[^>]+>/g, ""),
      inReplyTo: threadId,
      references: [threadId],
    });
  }

  // ── Token (no-op) ────────────────────────────────────────────────────────────

  async getFreshAccessToken(): Promise<string> {
    return "";
  }

  // ── Test Connection ─────────────────────────────────────────────────────────

  async testConnection(): Promise<ConnectionTestResult> {
    const { smtpHost, smtpPort, username } = this.mailbox;

    if (!smtpHost || !smtpPort || !username) {
      return { ok: false, error: "Missing SMTP configuration" };
    }
    if (smtpPort !== 587 && smtpPort !== 465) {
      return { ok: false, error: "SMTP port must be 587 or 465" };
    }

    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      const endpoint = await this.resolveHost(smtpHost);
      const isImplicitTls = smtpPort === 465;
      transport = nodemailer.createTransport({
        host: endpoint.address,
        port: smtpPort,
        secure: isImplicitTls,
        requireTLS: true,
        auth: { user: username, pass: this.creds.password },
        connectionTimeout,
        greetingTimeout: connectionTimeout,
        socketTimeout,
        dnsTimeout: 5_000,
        tls: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
          servername: endpoint.servername,
        },
      });
      const verified = await transport.verify();
      if (verified) {
        return { ok: true };
      }
      return { ok: false, error: "SMTP verification failed" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError =
        message.includes("Invalid login") ||
        message.includes("Authentication") ||
        message.includes("535");
      return {
        ok: false,
        error: message,
        requiresReconnect: isAuthError,
      };
    } finally {
      transport?.close();
    }
  }

  // ── Close ────────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.imap) {
      try {
        await this.imap.logout();
      } catch {
        // Already disconnected — ignore
      }
      this.imap = null;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function flattenBody(root?: BodyNode): BodyNode[] {
  const nodes: BodyNode[] = [];
  const pending = root ? [root] : [];
  while (pending.length > 0 && nodes.length < maxBodyParts) {
    const node = pending.shift()!;
    nodes.push(node);
    pending.unshift(...(node.childNodes ?? []));
  }
  return nodes;
}

function findPart(nodes: BodyNode[], type: string): BodyNode | undefined {
  return nodes.find((node) => node.type === type && node.disposition !== "attachment");
}

// A single-part message has no part number in its structure, and is part 1 on the wire.
async function readPart(client: ImapFlow, uid: number, node?: BodyNode) {
  if (!node) return undefined;
  const { content } = await client.download(String(uid), node.part ?? "1", {
    uid: true,
    maxBytes: maxMessageBytes,
  });
  const chunks: Buffer[] = [];
  for await (const chunk of content) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Extract a RawMessage from an ImapFlow fetch result.
 * Parses headers from the raw source string.
 */
function parseRawEmail(raw: string, msg: { envelope: any; uid: number }): RawMessage {
  const headerSection = raw.split(/\r?\n\r?\n/)[0] ?? "";
  const headers: Record<string, string> = {};

  // Parse header lines (handle folded headers)
  const lines = headerSection.split(/\r?\n/);
  let currentKey = "";
  for (const line of lines) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] = (headers[currentKey] ?? "") + " " + line.trim();
    } else {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).toLowerCase();
        headers[currentKey] = line.slice(colonIdx + 1).trim();
      }
    }
  }

  const envelope = msg.envelope ?? {};
  const toAddresses: string[] = (envelope.to ?? []).map((a: any) => a.address ?? "");

  return {
    messageId: envelope.messageId ?? headers["message-id"] ?? `uid-${msg.uid}`,
    providerMessageId: String(msg.uid),
    from: envelope.from?.[0]?.address ?? headers["from"] ?? "",
    to: toAddresses,
    subject: envelope.subject ?? headers["subject"] ?? "",
    headers,
    inReplyTo: headers["in-reply-to"],
    references: headers["references"]
      ? headers["references"].split(/\s+/).filter(Boolean)
      : undefined,
    mimeType: headers["content-type"],
    receivedAt: envelope.date ? new Date(envelope.date).getTime() : Date.now(),
  };
}
