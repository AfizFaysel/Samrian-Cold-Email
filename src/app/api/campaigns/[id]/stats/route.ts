import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresAssignmentRepo, PostgresStatsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.campaignStats,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const counts = await new PostgresStatsRepo(db).getCampaignStats({ orgId, campaignId: id });
    const assigned = await new PostgresAssignmentRepo(db).countByStatus(id, orgId);
    const stats = buildStatsSummary({ ...counts, openTrackingEnabled: false });
    return NextResponse.json({
      totalContacts: Object.values(assigned).reduce((total, count) => total + count, 0),
      emailsSent: stats.sent,
      estimatedOpenRate: stats.estimatedOpenRate,
      openTrackingEnabled: stats.openTrackingEnabled,
      replyRate: stats.replyRate,
      bounceRate: stats.bounceRate,
      unsubscribeRate: stats.unsubscribeRate,
      clickRate: stats.clickRate,
      activeContacts: assigned.active ?? 0,
      repliedContacts: stats.replies,
      bouncedContacts: stats.hardBounces + stats.softBounces,
      completedContacts: assigned.completed ?? 0,
    });
  }
);
