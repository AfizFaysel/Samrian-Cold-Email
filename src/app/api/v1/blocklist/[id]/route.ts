import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresBlocklistRepo } from "@/server/repos";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "blocklist.remove",
    credentials,
    handler: async ({ principal }) => {
      const { id } = await context.params;
      const result = await new PostgresBlocklistRepo(getDb()).removeById(id, principal.orgId);
      if (result === "missing") {
        throw new ApiRouteError("NOT_FOUND", "Blocklist entry not found", 404);
      }
      if (result === "opt-out") {
        throw new ApiRouteError("CONFLICT", "This address unsubscribed", 409);
      }
      return { data: { removed: true } };
    },
  })(request);
}
