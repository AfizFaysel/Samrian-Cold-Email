import { and, eq, ne } from "drizzle-orm";

import { blocklist } from "../db/schema";
import type { BlocklistRecord, OrgId } from "../ports";
import type { DbExecutor } from "../db/tx";
import { newId } from "./ids";

export type BlocklistReason = "unsubscribed" | "bounced_hard" | "manual";

export type BlocklistRemoval = "removed" | "missing" | "opt-out";

export type BlocklistEntry = BlocklistRecord & {
  _id: string;
  _creationTime: number;
  createdAt: number;
  campaignId?: string;
  unsubscribeToken?: string;
};

export class PostgresBlocklistRepo {
  constructor(private readonly db: DbExecutor) {}

  async add(input: BlocklistRecord): Promise<void> {
    const email = normalize(input.email);
    const reason = toReason(input.reason);
    const existing = await this.find(email, input.orgId);
    if (existing) {
      if (reason === "unsubscribed") {
        await this.db
          .update(blocklist)
          .set({ reason })
          .where(and(eq(blocklist.email, email), eq(blocklist.orgId, input.orgId)));
      }
      return;
    }

    await this.db.insert(blocklist).values({
      id: newId("block"),
      orgId: input.orgId,
      email,
      reason,
    });
  }

  // An opt-out is the recipient's decision, so nobody in the organization can lift it.
  async remove(email: string, orgId: OrgId): Promise<BlocklistRemoval> {
    const matches = and(eq(blocklist.email, normalize(email)), eq(blocklist.orgId, orgId));
    const rows = await this.db.select({ reason: blocklist.reason }).from(blocklist).where(matches);
    if (rows.length === 0) return "missing";
    if (rows.some((row) => row.reason === "unsubscribed")) return "opt-out";

    await this.db.delete(blocklist).where(and(matches, ne(blocklist.reason, "unsubscribed")));
    return "removed";
  }

  async removeById(id: string, orgId: OrgId): Promise<BlocklistRemoval> {
    const [row] = await this.db
      .select({ email: blocklist.email })
      .from(blocklist)
      .where(and(eq(blocklist.id, id), eq(blocklist.orgId, orgId)))
      .limit(1);
    return row ? this.remove(row.email, orgId) : "missing";
  }

  async list(orgId: OrgId, limit = 100): Promise<BlocklistRecord[]> {
    const rows = await this.db
      .select()
      .from(blocklist)
      .where(eq(blocklist.orgId, orgId))
      .limit(limit);
    return rows.map((row) => ({
      orgId: row.orgId,
      email: row.email,
      reason: row.reason,
    }));
  }

  async listEntries(orgId: OrgId, limit = 100): Promise<BlocklistEntry[]> {
    const rows = await this.db
      .select()
      .from(blocklist)
      .where(eq(blocklist.orgId, orgId))
      .limit(limit);
    return rows.map((row) => ({
      _id: row.id,
      _creationTime: row.createdAt.getTime(),
      orgId: row.orgId,
      email: row.email,
      reason: row.reason,
      campaignId: row.campaignId ?? undefined,
      unsubscribeToken: row.unsubscribeToken ?? undefined,
      createdAt: row.createdAt.getTime(),
    }));
  }

  async isBlocked(email: string, orgId: OrgId): Promise<boolean> {
    return !!(await this.find(email, orgId));
  }

  private async find(email: string, orgId: OrgId) {
    const [row] = await this.db
      .select({ id: blocklist.id })
      .from(blocklist)
      .where(and(eq(blocklist.email, normalize(email)), eq(blocklist.orgId, orgId)))
      .limit(1);
    return row ?? null;
  }
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

function toReason(reason: string | undefined): BlocklistReason {
  if (reason === "unsubscribed" || reason === "bounced_hard" || reason === "manual") return reason;
  return "manual";
}
