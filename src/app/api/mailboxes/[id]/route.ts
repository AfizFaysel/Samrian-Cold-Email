import { NextRequest, NextResponse } from "next/server";
import { isTimezone } from "@samrian/contracts";

import { errorResponse } from "@/server/api/error-response";
import { createSessionAction, createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { removeMailbox } from "@/server/modules/mailboxes";
import { PostgresAuditRepo, PostgresMailboxRepo } from "@/server/repos";
import {
  getMailboxRevocationToken,
  revokeGoogleToken,
} from "../../../../../lib/email-connectors/revoke";

export const DELETE = createSessionAction(
  sessionOperations.mailboxArchive,
  async (
    { orgId, userId, tenant },
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    try {
      const result = await removeMailbox(
        {
          mailboxId: id,
          orgId,
          userId,
          force: request.nextUrl.searchParams.get("force") === "true",
        },
        {
          now: Date.now,
          revokeToken: async (mailboxId, orgId) => {
            const token = await tenant((db) =>
              getMailboxRevocationToken(new PostgresMailboxRepo(db), mailboxId, orgId)
            );
            if (token) await revokeGoogleToken(token);
          },
          transaction: (operation) =>
            tenant((db) =>
              operation({
                mailboxes: new PostgresMailboxRepo(db),
                audit: new PostgresAuditRepo(db),
              })
            ),
        }
      );

      if (result.status === "missing") {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    } catch (error) {
      return errorResponse(error, "Failed to delete mailbox", "/api/mailboxes/[id]");
    }
  }
);

// The time zone whose midnight resets this mailbox's daily send count. Null means UTC.
export const PATCH = createSessionRoute(
  sessionOperations.mailboxUpdate,
  async ({ db, orgId }, request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { timezone?: unknown } | null;
    const timezone = body?.timezone;
    if (timezone !== null && (typeof timezone !== "string" || !isTimezone(timezone))) {
      return NextResponse.json({ error: "Choose a valid time zone" }, { status: 400 });
    }
    const updated = await new PostgresMailboxRepo(db).setTimezone(id, orgId, timezone);
    if (!updated) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    return NextResponse.json({ id, timezone });
  }
);
