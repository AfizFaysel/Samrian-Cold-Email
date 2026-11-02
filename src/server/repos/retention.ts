import { and, inArray, lt } from "drizzle-orm";

import { apiIdempotency, emailEvents, notifications } from "../db/schema";
import type { DbExecutor } from "../db/tx";
import type { OrgId } from "../ports";

export type RetentionCutoffs = {
  notificationsBefore: Date;
  eventsBefore: Date;
  now: Date;
};

const BATCH_SIZE = 5000;

export class PostgresRetentionRepo {
  constructor(private readonly db: DbExecutor) {}

  async listOrgs(cutoffs: RetentionCutoffs): Promise<OrgId[]> {
    const [expiredNotices, expiredEvents, expiredKeys] = await Promise.all([
      this.db
        .selectDistinct({ orgId: notifications.orgId })
        .from(notifications)
        .where(lt(notifications.createdAt, cutoffs.notificationsBefore)),
      this.db
        .selectDistinct({ orgId: emailEvents.orgId })
        .from(emailEvents)
        .where(lt(emailEvents.occurredAt, cutoffs.eventsBefore)),
      this.db
        .selectDistinct({ orgId: apiIdempotency.orgId })
        .from(apiIdempotency)
        .where(lt(apiIdempotency.expiresAt, cutoffs.now)),
    ]);
    return [
      ...new Set([...expiredNotices, ...expiredEvents, ...expiredKeys].map((row) => row.orgId)),
    ];
  }

  async purgeBatch(orgId: OrgId, cutoffs: RetentionCutoffs): Promise<number> {
    const notices = await this.db
      .delete(notifications)
      .where(
        inArray(
          notifications.id,
          this.db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                inArray(notifications.orgId, [orgId]),
                lt(notifications.createdAt, cutoffs.notificationsBefore)
              )
            )
            .limit(BATCH_SIZE)
        )
      )
      .returning();
    const events = await this.db
      .delete(emailEvents)
      .where(
        inArray(
          emailEvents.id,
          this.db
            .select({ id: emailEvents.id })
            .from(emailEvents)
            .where(
              and(
                inArray(emailEvents.orgId, [orgId]),
                lt(emailEvents.occurredAt, cutoffs.eventsBefore)
              )
            )
            .limit(BATCH_SIZE)
        )
      )
      .returning();
    const keys = await this.db
      .delete(apiIdempotency)
      .where(
        inArray(
          apiIdempotency.id,
          this.db
            .select({ id: apiIdempotency.id })
            .from(apiIdempotency)
            .where(
              and(inArray(apiIdempotency.orgId, [orgId]), lt(apiIdempotency.expiresAt, cutoffs.now))
            )
            .limit(BATCH_SIZE)
        )
      )
      .returning();
    return notices.length + events.length + keys.length;
  }
}
