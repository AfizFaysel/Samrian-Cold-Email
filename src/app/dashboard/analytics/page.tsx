"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Link } from "@astryxdesign/core/Link";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { pixel, proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Reply,
  Send,
  ShieldAlert,
  UserMinus,
} from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { TimePeriodSelector, type TimePeriod } from "@/components/time-period-selector";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type OrgAnalytics = {
  totalSent: number;
  replies: number;
  estimatedOpenRate: number | null;
  replyRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  clickRate: number | null;
};

interface CampaignRow extends Record<string, unknown> {
  _id: string;
  name: string;
  status: string;
  emailsSent: number;
  replyRate: number;
  bounceRate: number;
}

// Same thresholds as Overview: under 2% is healthy, 5% and up puts sending domains at risk.
const BOUNCE_WARN = 2;
const BOUNCE_DANGER = 5;

const pct = (value?: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`);
const bounceTone = (rate: number) =>
  rate >= BOUNCE_DANGER ? "text-error" : rate >= BOUNCE_WARN ? "text-warning" : undefined;

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = React.useState<TimePeriod>("30");
  const stats = useApi<OrgAnalytics>(`/api/analytics/org?days=${period}`);
  const campaigns = useApi<{ campaigns: CampaignRow[] }>("/api/campaigns");
  const loading = stats.isLoading && !stats.data;
  const bounceRate = stats.data?.bounceRate ?? 0;

  const ranked = React.useMemo(
    () =>
      [...(campaigns.data?.campaigns ?? [])]
        .filter((campaign) => campaign.emailsSent > 0)
        .sort((a, b) => b.replyRate - a.replyRate),
    [campaigns.data]
  );
  const bestReplyRate = Math.max(1, ...ranked.map((campaign) => campaign.replyRate));

  const columns = React.useMemo<TableColumn<CampaignRow>[]>(
    () => [
      {
        key: "name",
        header: "Campaign",
        width: proportional(2, { minWidth: 180 }),
        renderCell: (campaign) => (
          <Link href={`/dashboard/campaigns/${campaign._id}`} isStandalone>
            {campaign.name}
          </Link>
        ),
      },
      {
        key: "status",
        header: "Status",
        renderCell: (campaign) => <StatusBadge status={campaign.status} />,
      },
      {
        key: "emailsSent",
        header: "Sent",
        align: "end",
        width: pixel(80),
        renderCell: (campaign) => (
          <Text className="tabular-nums">{campaign.emailsSent.toLocaleString()}</Text>
        ),
      },
      {
        key: "replyRate",
        header: "Reply rate",
        width: proportional(2, { minWidth: 200 }),
        renderCell: (campaign) => (
          // Bar length is relative to the best campaign, so the ranking reads at a glance.
          <ProgressBar
            label={`${campaign.name} reply rate`}
            isLabelHidden
            hasValueLabel
            formatValueLabel={() => pct(campaign.replyRate)}
            value={campaign.replyRate}
            max={bestReplyRate}
          />
        ),
      },
      {
        key: "bounceRate",
        header: "Bounce rate",
        align: "end",
        width: pixel(112),
        renderCell: (campaign) => (
          <Text className={cn("tabular-nums", bounceTone(campaign.bounceRate))}>
            {pct(campaign.bounceRate)}
          </Text>
        ),
      },
    ],
    [bestReplyRate]
  );

  return (
    <Page
      title="Analytics"
      description="Which campaigns land replies, and whether your sending stays healthy."
      actions={<TimePeriodSelector value={period} onChange={setPeriod} />}
    >
      {stats.error && !stats.data ? (
        <Panel>
          <ErrorState title="Couldn't load analytics" onRetry={stats.refetch} />
        </Panel>
      ) : (
        <Grid columns={{ minWidth: 160, repeat: "fit" }} gap={4}>
          <StatCard
            label="Emails sent"
            icon={Send}
            isLoading={loading}
            value={(stats.data?.totalSent ?? 0).toLocaleString()}
            hint={`Last ${period} days`}
          />
          <StatCard
            label="Reply rate"
            icon={Reply}
            isLoading={loading}
            value={pct(stats.data?.replyRate)}
            hint={`${(stats.data?.replies ?? 0).toLocaleString()} people replied`}
          />
          <StatCard
            label="Open rate"
            icon={Eye}
            isLoading={loading}
            value={pct(stats.data?.estimatedOpenRate)}
            hint={stats.data?.estimatedOpenRate == null ? "Open tracking is off" : "Estimated"}
          />
          <StatCard
            label="Click rate"
            icon={MousePointerClick}
            isLoading={loading}
            value={pct(stats.data?.clickRate)}
          />
          <StatCard
            label="Bounce rate"
            icon={ShieldAlert}
            isLoading={loading}
            value={<span className={bounceTone(bounceRate)}>{pct(bounceRate)}</span>}
            hint={
              bounceRate >= BOUNCE_DANGER
                ? "Too high: clean your list"
                : bounceRate >= BOUNCE_WARN
                  ? "Watch this: aim under 2%"
                  : "Healthy: under 2%"
            }
          />
          <StatCard
            label="Unsubscribe rate"
            icon={UserMinus}
            isLoading={loading}
            value={pct(stats.data?.unsubscribeRate)}
          />
        </Grid>
      )}

      <Panel title="Campaigns by reply rate" description="All time, campaigns that have sent.">
        {campaigns.error && !campaigns.data ? (
          <ErrorState title="Couldn't load campaigns" onRetry={campaigns.refetch} />
        ) : !campaigns.data ? (
          <RowsSkeleton rows={4} />
        ) : ranked.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing to compare yet"
            description="Once a campaign sends its first emails, its results show up here."
            action={
              <Button
                label="Go to campaigns"
                variant="secondary"
                onClick={() => router.push("/dashboard/campaigns")}
              />
            }
          />
        ) : (
          <Table data={ranked} columns={columns} idKey="_id" hasHover />
        )}
      </Panel>
    </Page>
  );
}
