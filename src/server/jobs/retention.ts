import { RETENTION } from "../data/retention";
import { logger } from "../observability/runtime";
import type { OrgId } from "../ports";
import type { RetentionCutoffs } from "../repos/retention";

const DAY = 24 * 60 * 60 * 1000;
const MAX_BATCHES = 20;

export type RetentionStore = {
  listOrgs(cutoffs: RetentionCutoffs): Promise<OrgId[]>;
  purgeBatch(orgId: OrgId, cutoffs: RetentionCutoffs): Promise<number>;
};

// Each batch is its own transaction, and a large backlog simply finishes over later runs.
export async function purgeExpired(deps: {
  now(): number;
  system<T>(operation: (repo: RetentionStore) => Promise<T>): Promise<T>;
  tenant<T>(orgId: OrgId, operation: (repo: RetentionStore) => Promise<T>): Promise<T>;
}) {
  const now = deps.now();
  const cutoffs = {
    notificationsBefore: new Date(now - RETENTION.notificationsDays * DAY),
    eventsBefore: new Date(now - RETENTION.rawEventsDays * DAY),
    now: new Date(now),
  };
  const orgs = await deps.system((repo) => repo.listOrgs(cutoffs));

  let purged = 0;
  let failed = 0;
  for (const orgId of orgs) {
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const removed = await deps.tenant(orgId, (repo) => repo.purgeBatch(orgId, cutoffs));
        purged += removed;
        if (removed === 0) break;
      }
    } catch (error) {
      logger.error("retention.purge_failed", { orgId, error });
      failed += 1;
    }
  }

  return { status: "purged" as const, orgs: orgs.length, purged, failed };
}
