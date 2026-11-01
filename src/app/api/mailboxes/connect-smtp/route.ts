/**
 * SMTP Mailbox Connect API Route
 *
 * Handles form submissions for connecting SMTP/IMAP mailboxes.
 * Encrypts the password through the server credential Module, then stores
 * the encrypted blob through the Postgres mailbox repo.
 *
 * This ensures plaintext passwords never reach persistent storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/server/api/error-response";
import { encryptCredential as encrypt } from "@/server/crypto";
import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { clampDailyLimit, getProviderPolicy } from "@/server/modules/providers";
import { PostgresMailboxRepo, PostgresSettingsRepo } from "@/server/repos";
import { newId } from "@/server/repos";

// Hardcoded SMTP/IMAP defaults per provider (optional - user can override)
const PROVIDER_DEFAULTS: Record<
  string,
  { smtpHost?: string; smtpPort?: number; imapHost?: string; imapPort?: number }
> = {
  puzzle: {
    smtpHost: "smtp.puzzle.io",
    smtpPort: 587,
    imapHost: "imap.puzzle.io",
    imapPort: 993,
  },
  mailpool: {
    smtpHost: "smtp.mailpool.com",
    smtpPort: 587,
    imapHost: "imap.mailpool.com",
    imapPort: 993,
  },
  smtp: {
    // Custom SMTP - no defaults, user must provide
  },
};

export const POST = createSessionRoute(
  sessionOperations.mailboxConnect,
  async ({ orgId, db }, request: NextRequest) => {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(120),
        provider: z.enum(["puzzle", "mailpool", "smtp"]),
        username: z.string().trim().min(3).max(254),
        password: z.string().min(1).max(1024),
        dailySendLimit: z.number().int().positive().max(10_000).optional(),
        smtpHost: z.string().max(253).optional(),
        smtpPort: z.number().int().min(1).max(65_535).optional(),
        imapHost: z.string().max(253).optional(),
        imapPort: z.number().int().min(1).max(65_535).optional(),
      })
      .safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid mailbox details" }, { status: 400 });
    }
    const body = parsed.data;

    // Apply provider defaults if not specified
    const defaults = PROVIDER_DEFAULTS[body.provider] || {};
    const smtpHost = body.smtpHost ?? defaults?.smtpHost;
    const smtpPort = body.smtpPort ?? defaults?.smtpPort ?? 587;
    const imapHost = body.imapHost ?? defaults?.imapHost;
    const imapPort = body.imapPort ?? defaults?.imapPort ?? 993;

    if (!smtpHost) {
      return NextResponse.json({ error: "SMTP host is required" }, { status: 400 });
    }
    if (!imapHost) {
      return NextResponse.json({ error: "IMAP host is required" }, { status: 400 });
    }

    const mailboxId = newId("mailbox");

    // Bind credential to tenant, mailbox, provider, and field before storage.
    let encryptedPassword: string;
    try {
      encryptedPassword = encrypt(body.password, {
        orgId,
        mailboxId,
        provider: body.provider,
        purpose: "password",
      });
    } catch {
      return NextResponse.json({ error: "Encryption failed" }, { status: 500 });
    }

    try {
      const repo = new PostgresMailboxRepo(db);
      const sending = await new PostgresSettingsRepo(db).getSending(orgId);
      const provider = body.provider as "puzzle" | "mailpool" | "smtp";
      const requestedLimit =
        body.dailySendLimit ?? getProviderPolicy(provider).recommendedDailyLimit;
      const mailbox = await repo.create({
        id: mailboxId,
        orgId,
        name: body.name,
        provider,
        smtpHost,
        smtpPort,
        imapHost,
        imapPort,
        username: body.username,
        encryptedPassword,
        userEmail: body.username,
        dailySendLimit: clampDailyLimit(provider, requestedLimit),
        rampEnabled: sending.defaultRampEnabled,
        rampCurrentLimit: sending.defaultRampEnabled ? 5 : undefined,
        rampTargetLimit: Math.min(
          sending.defaultRampTarget,
          getProviderPolicy(provider).maxSafeDailyLimit
        ),
      });

      return NextResponse.json({ id: mailbox.id, success: true });
    } catch (error) {
      return errorResponse(error, "Failed to save mailbox", "/api/mailboxes/connect-smtp");
    }
  }
);
