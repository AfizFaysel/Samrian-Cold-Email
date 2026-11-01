import { describe, expect, test } from "vitest";

import {
  classifyInbound,
  normalizeInboundMessage,
  normalizeMessageId,
} from "../../../src/server/modules/inbound";
import type { RawMessage } from "../../../src/server/jobs/types";

describe("inbound classification", () => {
  test("classifies delivery status report as bounce, not reply", () => {
    expect(
      classifyInbound(
        raw({
          inReplyTo: "<sent_1@example.com>",
          from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
          subject: "Delivery Status Notification (Failure)",
          textBody: "Address not found. 550 5.1.1 NoSuchUser.",
          headers: { "Content-Type": "multipart/report; report-type=delivery-status" },
        })
      )
    ).toMatchObject({ kind: "bounce" });
  });

  test("classifies read receipt as auto-reply", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Read: Product update",
          textBody: "This is a Return Receipt for the mail that you sent.",
          mimeType: "multipart/report",
          partMimeTypes: ["text/plain", "message/disposition-notification"],
          headers: { "Content-Type": "multipart/report; report-type=disposition-notification" },
        })
      )
    ).toMatchObject({ kind: "auto-reply" });
  });

  test("classifies out-of-office as auto-reply", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Re: Hello",
          textBody: "I am out of office this week.",
          headers: { "Auto-Submitted": "auto-replied" },
        })
      )
    ).toMatchObject({ kind: "auto-reply" });
  });

  test("classifies unsubscribe phrases as unsubscribe", () => {
    expect(
      classifyInbound(
        raw({
          subject: "Re: Hello",
          textBody: "Please remove me from your list.",
        })
      )
    ).toMatchObject({ kind: "unsubscribe" });
  });

  test("normalizes bracketed message ids", () => {
    expect(normalizeMessageId(" <Sent_1@Example.com> ")).toBe("sent_1@example.com");
  });

  test("keeps the start of an oversized message so its intent is not lost", () => {
    const normalized = normalizeInboundMessage(
      raw({
        textBody: `Please remove me${"x".repeat(256 * 1024)}`,
        htmlBody: "y".repeat(256 * 1024),
      })
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.message.textBody).toHaveLength(256 * 1024);
    expect(normalized.message.htmlBody).toBe("");
    expect(classifyInbound(normalized.message).kind).toBe("unsubscribe");
  });

  describe("what the sender wrote", () => {
    const kind = (message: Partial<RawMessage>) =>
      classifyInbound(raw({ inReplyTo: "sent_1", ...message })).kind;
    const quotedFooter = "> To unsubscribe, click here";

    test.each([
      [`Yes, interested!\n\nOn Tuesday Sam wrote:\n${quotedFooter}`],
      [
        `Yes, interested!\n\nOn Tue, Jan 6, 2026 at 3:00 PM Sam Lee <\nsam@x.com> wrote:\n${quotedFooter}`,
      ],
      [`Si, me interesa\n\nEl mar, 6 ene 2026, Sam escribió:\n${quotedFooter}`],
      [`Oui, merci\n\nLe mar. 6 janv. 2026, Sam a écrit :\n${quotedFooter}`],
      [`Yes\n\n-----Original Message-----\nFrom: Sam\nTo unsubscribe, click here`],
      [`Yes\n\nFrom: Sam Lee\nSent: Tuesday\nTo unsubscribe, click here`],
    ])("ignores a quoted footer in %j", (textBody) => {
      expect(kind({ textBody })).toBe("reply");
    });

    test("still sees an opt-out written below the quote", () => {
      expect(kind({ textBody: `${quotedFooter}\n\nPlease remove me` })).toBe("unsubscribe");
    });

    test.each([
      ["<p>Yes!</p><blockquote>To unsubscribe, click here</blockquote>"],
      ['<p>Yes!</p><div class="gmail_quote">To unsubscribe, click here</div>'],
      ['<p>Yes!</p><div id="divRplyFwdMsg">To unsubscribe, click here</div>'],
    ])("ignores quoted html in %j", (htmlBody) => {
      expect(kind({ htmlBody })).toBe("reply");
    });

    test("does not read an inherited subject as the sender's words", () => {
      expect(kind({ subject: "Re: How to unsubscribe users", textBody: "Sounds good" })).toBe(
        "reply"
      );
    });

    test("does read a subject the sender wrote", () => {
      expect(kind({ subject: "Unsubscribe", textBody: "" })).toBe("unsubscribe");
    });

    test("does not treat a quoted out-of-office as an auto-reply", () => {
      expect(kind({ textBody: "Great\n\nOn Tuesday Sam wrote:\n> I am out of office" })).toBe(
        "reply"
      );
    });

    test.each([
      ["Por favor, elimínenme de su lista"],
      ["Quiero darme de baja"],
      ["Veuillez me désinscrire"],
      ["Merci de me retirer de votre liste"],
      ["Bitte austragen"],
      ["Bitte keine E-Mails mehr"],
      ["Por favor, me descadastre"],
      ["Vi prego di cancellarmi dalla lista"],
    ])("recognizes the opt-out %j", (textBody) => {
      expect(kind({ textBody })).toBe("unsubscribe");
    });

    test.each([
      ["We are on version 5.1.1 of the app"],
      ["The delivery status notification page is broken"],
      ["Our last order was undeliverable, can you help?"],
    ])("does not treat the human reply %j as a bounce", (textBody) => {
      expect(kind({ textBody })).toBe("reply");
    });

    test("still recognizes a plain bounce from a mail system", () => {
      expect(
        kind({ from: "MAILER-DAEMON@example.com", textBody: "Your message was undeliverable" })
      ).toBe("bounce");
    });
  });

  test("rejects excessive headers and mime parts", () => {
    const headers = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`x-test-${index}`, "value"])
    );

    expect(normalizeInboundMessage(raw({ headers }))).toEqual({
      ok: false,
      reason: "too-many-headers",
    });
    expect(
      normalizeInboundMessage(
        raw({
          partMimeTypes: Array.from({ length: 101 }, () => "multipart/mixed"),
        })
      )
    ).toEqual({ ok: false, reason: "too-many-parts" });
  });

  test("removes nulls and bidi controls from stored envelope fields", () => {
    const result = normalizeInboundMessage(
      raw({
        from: "Ada\u202E <ada@example.com>\0",
        subject: "Invoice\u202Efdp.exe\0",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      message: {
        from: "Ada <ada@example.com>",
        subject: "Invoicefdp.exe",
      },
    });
  });

  test("rejects excessive attachment metadata", () => {
    expect(
      normalizeInboundMessage(
        raw({
          attachments: Array.from({ length: 26 }, (_, index) => ({
            id: `attachment_${index}`,
            filename: `file_${index}.pdf`,
            size: 10,
            contentType: "application/pdf",
            inline: false,
          })),
        })
      )
    ).toEqual({ ok: false, reason: "invalid-attachments" });
  });

  test("rejects oversized provider identifiers and envelope addresses", () => {
    expect(
      normalizeInboundMessage(
        raw({
          providerMessageId: "x".repeat(999),
        })
      )
    ).toEqual({ ok: false, reason: "invalid-envelope" });

    expect(
      normalizeInboundMessage(
        raw({
          to: ["x".repeat(999)],
        })
      )
    ).toEqual({ ok: false, reason: "invalid-envelope" });
  });
});

function raw(input: Partial<RawMessage>): RawMessage {
  return {
    messageId: "reply_1",
    from: "ada@example.com",
    to: ["sender@example.com"],
    subject: "Re: Hello",
    textBody: "Human reply",
    headers: {},
    receivedAt: 1,
    ...input,
  };
}
