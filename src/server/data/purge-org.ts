import { sql } from "drizzle-orm";

import { TENANT_TABLES } from "../db/rls";
import type { DbClient } from "../db/tx";

const AUTH_RECORDS = [
  ["members", "organization_id"],
  ["invitations", "organization_id"],
  ["organization_roles", "organization_id"],
  ["apikeys", "reference_id"],
  ["organizations", "id"],
] as const;

const TABLES = [...TENANT_TABLES.map((table) => [table, "org_id"] as const), ...AUTH_RECORDS];

// Row-level security hides other rows from every runtime role, so this needs the migration owner.
// Provider tokens are deleted here but stay valid until the customer revokes them at the provider.
export async function purgeOrganization(
  db: Pick<DbClient, "transaction">,
  orgId: string,
  options: { confirm?: boolean } = {}
): Promise<Record<string, number>> {
  return db.transaction(async (tx) => {
    const counts: Record<string, number> = {};
    for (const [table, column] of TABLES) {
      const where = sql`${sql.identifier(column)} = ${orgId}`;
      const result = await tx.execute(
        sql`select count(*)::int as count from ${sql.identifier(table)} where ${where}`
      );
      counts[table] = Number((result as unknown as Array<{ count: number }>)[0]?.count ?? 0);
      if (options.confirm) {
        await tx.execute(sql`delete from ${sql.identifier(table)} where ${where}`);
      }
    }
    return counts;
  });
}
