import { NextResponse } from "next/server";

import { errorResponse } from "@/server/api/error-response";
import { createSessionAction } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { getDb } from "@/server/db/db";
import { sendReply } from "@/server/modules/inbox";
import { createPostgresJobRepos, createTenantConnectorFactory } from "@/server/repos";

export const POST = createSessionAction(
  sessionOperations.inboxReply,
  async (
    { orgId, userId, tenant },
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await context.params;
    const body = await request.json();

    try {
      const result = await sendReply(
        {
          orgId,
          userId,
          threadId: id,
          body: String(body.body ?? ""),
          subject: typeof body.subject === "string" ? body.subject : undefined,
          clientRequestId:
            typeof body.clientRequestId === "string" && body.clientRequestId.trim()
              ? body.clientRequestId.trim()
              : crypto.randomUUID(),
        },
        {
          transaction: (operation) =>
            tenant((db) => {
              const repos = createPostgresJobRepos(db);
              return operation({ mailboxes: repos.mailboxes, threads: repos.threads });
            }),
          connectorForMailbox: createTenantConnectorFactory(getDb(), {
            actorType: "request",
            userId,
          }),
          now: Date.now,
        }
      );

      return NextResponse.json(result);
    } catch (error) {
      return errorResponse(error, "Reply failed", "/api/inbox/threads/[id]/reply");
    }
  },
  { operationId: "inbox.reply", bodyLimitBytes: 128 * 1024 }
);
