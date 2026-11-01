import { notifyCampaignPaused } from "./notifications";
import type { CampaignId, CampaignStatus, NotificationRepo, OrgId } from "../ports";

export const MIN_HEALTH_SAMPLE = 20;

export type CampaignHealthInput = {
  campaignId: CampaignId;
  orgId: OrgId;
  campaignName?: string;
  stats: {
    total: number;
    bounced: number;
    unsubscribed: number;
  };
  thresholds: {
    bouncePauseRate: number;
    unsubscribePauseRate: number;
    minSample: number;
  };
};

export type CampaignHealthDeps = {
  campaigns: {
    transitionStatus(
      id: CampaignId,
      orgId: OrgId,
      from: CampaignStatus[],
      to: CampaignStatus
    ): Promise<boolean>;
  };
  notifications?: NotificationRepo;
};

export async function evaluateCampaignHealth(input: CampaignHealthInput, deps: CampaignHealthDeps) {
  if (input.stats.total < input.thresholds.minSample) return { paused: false as const };

  const reason = getPauseReason(input);
  if (!reason) return { paused: false as const };

  const paused = await deps.campaigns.transitionStatus(
    input.campaignId,
    input.orgId,
    ["active"],
    "paused"
  );
  if (!paused) return { paused: false as const };

  await notifyCampaignPaused(deps.notifications, {
    orgId: input.orgId,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    reason,
  });
  return { paused: true as const, reason };
}

function getPauseReason(input: CampaignHealthInput): "bounce-rate" | "unsubscribe-rate" | null {
  if (input.stats.bounced / input.stats.total > input.thresholds.bouncePauseRate) {
    return "bounce-rate";
  }
  if (input.stats.unsubscribed / input.stats.total > input.thresholds.unsubscribePauseRate) {
    return "unsubscribe-rate";
  }
  return null;
}
