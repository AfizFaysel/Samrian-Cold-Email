import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import {
  CampaignLaunchError,
  createCampaignLaunchDeps,
  resumeCampaign,
} from "@/server/modules/campaigns";
import { withRequestTelemetry } from "@/server/observability";

const resume = createSessionRoute(
  sessionOperations.campaignLaunch,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    try {
      return NextResponse.json(
        await resumeCampaign({ campaignId: id, orgId }, createCampaignLaunchDeps(db))
      );
    } catch (error) {
      if (error instanceof CampaignLaunchError) {
        return NextResponse.json(
          { error: error.issues.join(". "), issues: error.issues },
          { status: 400 }
        );
      }
      throw error;
    }
  },
  { operationId: "campaigns.resume" }
);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return await withRequestTelemetry(
    {
      route: "/api/campaigns/[id]/resume",
      method: request.method,
      requestId: request.headers.get("x-request-id") ?? undefined,
    },
    () => resume(request, context)
  );
}
