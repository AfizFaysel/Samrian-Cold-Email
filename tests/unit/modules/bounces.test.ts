import { describe, expect, test } from "vitest";

import {
  bounceNamesRecipient,
  classifyBounce,
  parseBounce,
} from "../../../src/server/modules/bounces";
import type { RawMessage } from "../../../src/server/jobs/types";

describe("bounce recipient", () => {
  const dsn = (input: Partial<RawMessage>): RawMessage => ({
    messageId: "dsn_1",
    from: "mailer-daemon@example.com",
    to: ["sender@example.com"],
    subject: "Undeliverable",
    headers: {},
    receivedAt: 1,
    ...input,
  });

  test("matches a structured recipient", () => {
    const message = dsn({ textBody: "Final-Recipient: rfc822; Lead@Example.com\nStatus: 5.1.1" });

    expect(bounceNamesRecipient(message, "lead@example.com")).toBe(true);
    expect(bounceNamesRecipient(message, "other@example.com")).toBe(false);
  });

  test("a structured recipient outranks an address merely mentioned", () => {
    const message = dsn({
      textBody: "Final-Recipient: rfc822; other@example.com\nReported to lead@example.com",
    });

    expect(bounceNamesRecipient(message, "lead@example.com")).toBe(false);
  });

  test("reads the failed-recipients header", () => {
    const message = dsn({ headers: { "x-failed-recipients": "a@example.com, lead@example.com" } });

    expect(bounceNamesRecipient(message, "lead@example.com")).toBe(true);
  });

  test("accepts a plain bounce that names the address", () => {
    const message = dsn({ textBody: "<lead@example.com>: mailbox unavailable" });

    expect(bounceNamesRecipient(message, "lead@example.com")).toBe(true);
    expect(bounceNamesRecipient(message, "other@example.com")).toBe(false);
  });

  test("prefers the reported status over other numbers", () => {
    const message = dsn({ textBody: "Build 4.3.2 relayed this\nStatus: 5.1.1" });

    expect(parseBounce(message).dsnCode).toBe("5.1.1");
  });
});

describe("bounce parsing", () => {
  test("classifies 5.x.x DSN as hard bounce", () => {
    expect(classifyBounce({ dsnCode: "5.1.1" })).toBe("hard");
  });

  test("classifies 4.x.x DSN as soft bounce", () => {
    expect(classifyBounce({ dsnCode: "4.2.2" })).toBe("soft");
  });

  test("defaults unknown bounce to soft", () => {
    expect(classifyBounce({ rawBody: "Delivery delayed without a status code" })).toBe("soft");
  });

  test("parses failed recipient from DSN headers and body", () => {
    const result = parseBounce(
      raw({
        headers: {
          "Content-Type": "multipart/report; report-type=delivery-status",
          "X-Failed-Recipients": "bad@example.com",
        },
        textBody: "Status: 5.1.1\nDiagnostic-Code: smtp; user unknown",
      })
    );

    expect(result).toMatchObject({
      bounceType: "hard",
      dsnCode: "5.1.1",
      email: "bad@example.com",
    });
  });
});

function raw(input: Partial<RawMessage>): RawMessage {
  return {
    messageId: "message_1",
    from: "mailer-daemon@example.com",
    to: ["sender@example.com"],
    subject: "Delivery Status Notification",
    textBody: "",
    headers: {},
    receivedAt: 1,
    ...input,
  };
}
