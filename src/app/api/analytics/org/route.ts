import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { buildStatsSummary } from "@/server/modules/stats";
import { PostgresSettingsRepo, PostgresStatsRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.analyticsRead,
  async ({ db, orgId }, request: Request) => {
    const days = Number(new URL(request.url).searchParams.get("days"));
    const range =
      Number.isInteger(days) && days > 0 && days <= 365
        ? { from: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        : undefined;
    const counts = await new PostgresStatsRepo(db).getOrgStats(orgId, range);
    const { openTrackingEnabled } = await new PostgresSettingsRepo(db).getCompliance(orgId);
    const stats = buildStatsSummary({
      ...counts,
      openTrackingEnabled: openTrackingEnabled ?? false,
    });
    return NextResponse.json({
      totalSent: stats.sent,
      estimatedOpenRate: stats.estimatedOpenRate,
      openTrackingEnabled: stats.openTrackingEnabled,
      replyRate: stats.replyRate,
      bounceRate: stats.bounceRate,
      unsubscribeRate: stats.unsubscribeRate,
      clickRate: stats.clickRate,
      activeCampaigns: 0,
    });
  }
);
