import nodemailer from "nodemailer";

type MailEnv = Record<string, string | undefined>;

// Invitations and verification come from the product, so they never use a customer's mailbox.
export function isSystemMailConfigured(env: MailEnv = process.env): boolean {
  return Boolean(env.SYSTEM_SMTP_URL && env.SYSTEM_EMAIL_FROM);
}

export async function sendSystemEmail(input: { to: string; subject: string; text: string }) {
  const url = process.env.SYSTEM_SMTP_URL;
  const from = process.env.SYSTEM_EMAIL_FROM;
  if (!url || !from) throw new Error("SYSTEM_SMTP_URL and SYSTEM_EMAIL_FROM are required");

  const transport = nodemailer.createTransport(url);
  try {
    await transport.sendMail({ from, ...input });
  } finally {
    transport.close();
  }
}
