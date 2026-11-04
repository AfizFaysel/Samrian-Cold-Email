"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, MousePointerClick, Reply, Send, ShieldAlert, UserMinus } from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { TimePeriodSelector, type TimePeriod } from "@/components/time-period-selector";
import { buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type OrgAnalytics = {
  totalSent: number;
  estimatedOpenRate: number | null;
  replyRate: number;
  bounceRate?: number;
  unsubscribeRate?: number;
  clickRate?: number | null;
};

type CampaignRow = {
  _id: string;
  name: string;
  status: string;
  emailsSent: number;
  replyRate: number;
  bounceRate: number;
};

const pct = (value?: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`);

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState<TimePeriod>("30");
  const stats = useApi<OrgAnalytics>(`/api/analytics/org?days=${period}`);
  const campaigns = useApi<{ campaigns: CampaignRow[] }>("/api/campaigns");
  const loading = stats.isLoading && !stats.data;

  const ranked = React.useMemo(
    () =>
      [...(campaigns.data?.campaigns ?? [])]
        .filter((campaign) => campaign.emailsSent > 0)
        .sort((a, b) => b.replyRate - a.replyRate),
    [campaigns.data]
  );
  const bestReplyRate = Math.max(1, ...ranked.map((campaign) => campaign.replyRate));

  return (
    <Page
      title="Analytics"
      description="Delivery and engagement across every campaign."
      actions={<TimePeriodSelector value={period} onChange={setPeriod} />}
    >
      {stats.error && !stats.data ? (
        <Panel>
          <ErrorState title="Couldn't load analytics" onRetry={stats.refetch} />
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
            value={
              <span className={cn((stats.data?.bounceRate ?? 0) > 5 && "text-error")}>
                {pct(stats.data?.bounceRate)}
              </span>
            }
            hint={(stats.data?.bounceRate ?? 0) > 5 ? "Above 5%: clean your list" : "Keep under 2%"}
          />
          <StatCard
            label="Unsubscribe rate"
            icon={UserMinus}
            isLoading={loading}
            value={pct(stats.data?.unsubscribeRate)}
          />
        </div>
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
              <Link href="/dashboard/campaigns" className={buttonVariants({ variant: "outline" })}>
                Go to campaigns
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-base">
              <thead>
                <tr className="border-b text-sm text-secondary">
                  <th className="px-4 py-2.5 font-medium">Campaign</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="w-[38%] px-4 py-2.5 font-medium">Reply rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bounce rate</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((campaign) => (
                  <tr
                    key={campaign._id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/60"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/campaigns/${campaign._id}`}
                        className="hover:text-accent"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {campaign.emailsSent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent-bg"
                            style={{ width: `${(campaign.replyRate / bestReplyRate) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-right tabular-nums">
                          {campaign.replyRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        campaign.bounceRate > 5 && "text-error"
                      )}
                    >
                      {campaign.bounceRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
