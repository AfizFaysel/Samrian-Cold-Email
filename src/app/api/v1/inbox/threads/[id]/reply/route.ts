import { replySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PublicError } from "@/server/modules/public-error";
import { sendReply } from "@/server/modules/inbox";
import {
  createPostgresJobRepos,
  createTenantConnectorFactory,
  PostgresIdempotencyStore,
} from "@/server/repos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "inbox.reply",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(getDb(), {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    transaction: "explicit",
    bodyLimitBytes: 128 * 1024,
    handler: async ({ principal, tenant, request }) => {
      const parsed = replySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid reply", 400);
      const { id } = await context.params;
      try {
        const data = await sendReply(
          {
            orgId: principal.orgId,
            userId: principal.userId ?? principal.credentialId,
            threadId: id,
            ...parsed.data,
            clientRequestId: request.headers.get("idempotency-key")!,
          },
          {
            transaction: (operation) =>
              tenant((db) => {
                const repos = createPostgresJobRepos(db);
                return operation({ mailboxes: repos.mailboxes, threads: repos.threads });
              }),
            connectorForMailbox: createTenantConnectorFactory(getDb(), {
              actorType: "request",
              userId: principal.userId,
            }),
            now: Date.now,
          }
        );
        return { data };
      } catch (error) {
        if (error instanceof PublicError) {
          const code = { 404: "NOT_FOUND", 409: "CONFLICT" }[error.status] as
            "NOT_FOUND" | "CONFLICT" | undefined;
          throw new ApiRouteError(code ?? "VALIDATION_FAILED", error.message, error.status);
        }
        throw error;
      }
    },
  })(request);
}
