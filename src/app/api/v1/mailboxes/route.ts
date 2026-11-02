import { pageQuerySchema } from "@samrian/contracts";

import { ApiRouteError, createApiRoute } from "@/server/api/route";
import { getMachineCredential } from "@/server/auth/machine-provider";
import { getDb } from "@/server/db/db";
import { PostgresMailboxRepo } from "@/server/repos";

export async function GET(request: Request) {
  const credentials = await getMachineCredential();
  return createApiRoute({
    operation: "mailboxes.list",
    credentials,
    handler: async ({ principal }) => {
      const parsed = pageQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      if (!parsed.success) throw new ApiRouteError("VALIDATION_FAILED", "Invalid page", 400);
      const items = await new PostgresMailboxRepo(getDb()).listItems(
        principal.orgId,
        parsed.data.limit
      );
      return {
        data: {
          items: items.map((item) => ({
            id: item._id,
            name: item.name,
            provider: item.provider,
            ...(item.userEmail ? { email: item.userEmail } : {}),
            status: item.status,
            dailySendLimit: item.dailySendLimit,
            emailsSentToday: item.emailsSentToday,
            lastConnectionTestAt: item.lastConnectionTestAt,
            lastConnectionError: item.lastConnectionError,
            providerLimitCode: item.providerLimitCode,
            providerLimitResetAt: item.providerLimitResetAt,
            rampEnabled: item.rampEnabled,
            rampStatus: item.rampStatus,
            rampCurrentLimit: item.rampCurrentLimit,
            rampTargetLimit: item.rampTargetLimit,
            effectiveDailyLimit: item.effectiveDailyLimit,
            availableToday: item.availableToday,
          })),
        },
      };
    },
  })(request);
}
