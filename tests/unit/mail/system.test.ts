import { afterEach, describe, expect, test, vi } from "vitest";

const transport = vi.hoisted(() => ({ sendMail: vi.fn(async () => ({})), close: vi.fn() }));

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));

import nodemailer from "nodemailer";

import { isSystemMailConfigured, sendSystemEmail } from "../../../src/server/mail/system";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("system mail", () => {
  test("needs both a server and a from address", () => {
    expect(isSystemMailConfigured({})).toBe(false);
    expect(isSystemMailConfigured({ SYSTEM_SMTP_URL: "smtps://u:p@mail.test" })).toBe(false);
    expect(
      isSystemMailConfigured({
        SYSTEM_SMTP_URL: "smtps://u:p@mail.test",
        SYSTEM_EMAIL_FROM: "hello@app.test",
      })
    ).toBe(true);
  });

  test("sends through the configured server and closes it", async () => {
    vi.stubEnv("SYSTEM_SMTP_URL", "smtps://u:p@mail.test");
    vi.stubEnv("SYSTEM_EMAIL_FROM", "hello@app.test");

    await sendSystemEmail({ to: "ada@example.com", subject: "Hi", text: "Body" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith("smtps://u:p@mail.test");
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: "hello@app.test",
      to: "ada@example.com",
      subject: "Hi",
      text: "Body",
    });
    expect(transport.close).toHaveBeenCalledOnce();
  });

  test("refuses to send when unconfigured", async () => {
    await expect(
      sendSystemEmail({ to: "ada@example.com", subject: "Hi", text: "Body" })
    ).rejects.toThrow("SYSTEM_SMTP_URL and SYSTEM_EMAIL_FROM are required");
  });
});
