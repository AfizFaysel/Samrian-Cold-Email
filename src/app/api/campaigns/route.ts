import { NextResponse } from "next/server";
import { z } from "zod";
import { campaignDraftSchema } from "@samrian/contracts";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import {
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresStatsRepo,
} from "@/server/repos";
import { CampaignDraftError, saveCampaignDraft } from "@/server/modules/campaigns";
import type { StatsCounts } from "@/server/repos";

const zeroCounts: StatsCounts = {
  sent: 0,
  failed: 0,
  replies: 0,
  unsubscribes: 0,
  hardBounces: 0,
  softBounces: 0,
  totalClicks: 0,
  uniqueClicks: 0,
  totalOpens: 0,
  uniqueOpens: 0,
};

export const GET = createSessionRoute(sessionOperations.campaignList, async ({ orgId, db }) => {
  const campaigns = await new PostgresCampaignRepo(db).listItems(orgId);
  const [mailboxMap, statsMap] = await Promise.all([
    new PostgresCampaignMailboxRepo(db).mapForCampaigns(
      campaigns.map((campaign) => campaign.id),
      orgId
    ),
    new PostgresStatsRepo(db).sumByCampaign(orgId),
  ]);
  return NextResponse.json({
    campaigns: campaigns.map((campaign) => {
      const counts = statsMap.get(campaign.id) ?? zeroCounts;
      return {
        ...campaign,
        mailboxIds: mailboxMap.get(campaign.id) ?? [],
        emailsSent: counts.sent,
        replyRate: counts.sent > 0 ? (counts.replies / counts.sent) * 100 : 0,
        bounceRate:
          counts.sent > 0 ? ((counts.hardBounces + counts.softBounces) / counts.sent) * 100 : 0,
      };
    }),
  });
});

export const POST = createSessionRoute(
  sessionOperations.campaignCreate,
  async ({ orgId, db }, request: Request) => {
    const parsed = campaignDraftSchema
      .extend({ id: z.string().optional() })
      .safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid campaign draft", issues: parsed.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { name, schedule, steps } = body;

    let id: string;
    try {
      id = await saveCampaignDraft(
        {
          id: body.id,
          orgId,
          name,
          schedule,
          steps,
          targetGroupId: body.targetGroupId,
          targetContactIds: body.targetContactIds,
          mailboxIds: body.mailboxIds,
        },
        {
          campaigns: new PostgresCampaignRepo(db),
          campaignMailboxes: new PostgresCampaignMailboxRepo(db),
        }
      );
    } catch (error) {
      if (error instanceof CampaignDraftError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === "not-found" ? 404 : 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ id });
  }
);
