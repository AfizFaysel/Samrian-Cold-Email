import { groupWriteSchema, pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { GroupRulesError } from "@/server/modules/groups";
import { PostgresGroupRepo } from "@/server/repos";
import { PostgresIdempotencyStore } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "groups.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const groups = await new PostgresGroupRepo(getDb()).list(principal.orgId, parsed.data.limit);
      return { data: { items: groups.map(({ orgId: _orgId, ...group }) => group) } };
    },
  })(request);
}

export async function POST(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "groups.create",
    credentials,
    idempotency: ({ principal, operation }) =>
      new PostgresIdempotencyStore(getDb(), {
        orgId: principal.orgId,
        credentialId: principal.credentialId,
        operationId: operation.id,
      }),
    handler: async ({ principal, request }) => {
      const parsed = groupWriteSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid group", 400);
      try {
        const group = await new PostgresGroupRepo(getDb()).create({
          ...parsed.data,
          orgId: principal.orgId,
          createdBy: principal.userId ?? principal.credentialId,
        });
        const { orgId: _orgId, ...data } = group;
        return { data };
      } catch (error) {
        if (error instanceof GroupRulesError) {
          throw new ApiRouteError("VALIDATION_FAILED", error.message, 400);
        }
        throw error;
      }
    },
  })(request);
}
