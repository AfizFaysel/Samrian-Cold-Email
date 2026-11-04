"use client";

import * as React from "react";
import { AlertTriangle, Reply, Send, Users } from "lucide-react";
import { Panel } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface CampaignAnalyticsProps {
  campaignId: string;
}

type CampaignStats = {
  totalContacts: number;
  emailsSent: number;
  replyRate: number;
  activeContacts: number;
  repliedContacts: number;
  bouncedContacts: number;
  completedContacts: number;
};

export function CampaignAnalytics({ campaignId }: CampaignAnalyticsProps) {
  const {
    data: stats,
    error,
    isLoading,
    refetch,
  } = useApi<CampaignStats>(`/api/campaigns/${campaignId}/stats`);

  if (error && !stats) {
    return (
      <Panel>
        <ErrorState title="Couldn't load campaign numbers" onRetry={refetch} />
      </Panel>
    );
  }

  const loading = isLoading && !stats;
  const bounceRate =
    stats && stats.emailsSent > 0 ? (stats.bouncedContacts / stats.emailsSent) * 100 : 0;

  const breakdown = [
    { label: "In sequence", count: stats?.activeContacts ?? 0, color: "bg-accent-bg" },
    { label: "Replied", count: stats?.repliedContacts ?? 0, color: "bg-success" },
    { label: "Bounced", count: stats?.bouncedContacts ?? 0, color: "bg-error" },
    { label: "Finished", count: stats?.completedContacts ?? 0, color: "bg-neutral" },
  ];
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Contacts"
          icon={Users}
          isLoading={loading}
          value={stats?.totalContacts.toLocaleString()}
        />
        <StatCard
          label="Emails sent"
          icon={Send}
          isLoading={loading}
          value={stats?.emailsSent.toLocaleString()}
        />
        <StatCard
          label="Reply rate"
          icon={Reply}
          isLoading={loading}
          value={`${stats?.replyRate.toFixed(1) ?? "0.0"}%`}
        />
        <StatCard
          label="Bounce rate"
          icon={AlertTriangle}
          isLoading={loading}
          value={
            <span className={cn(bounceRate > 5 && "text-error")}>{bounceRate.toFixed(1)}%</span>
          }
          hint={bounceRate > 5 ? "Above 5%: check your list" : undefined}
        />
      </div>

      <Panel title="Where contacts are">
        {loading ? (
          <div className="p-4">
            <div className="h-3 animate-pulse rounded-full bg-muted" />
          </div>
        ) : total === 0 ? (
          <EmptyState
            className="py-10"
            icon={Users}
            title="No contacts assigned yet"
            description="Contacts appear here once the campaign assigns them."
          />
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
              {breakdown.map((item) =>
                item.count > 0 ? (
                  <div
                    key={item.label}
                    className={cn(item.color, "transition-all duration-300")}
                    style={{ width: `${(item.count / total) * 100}%` }}
                    title={`${item.label}: ${item.count}`}
                  />
                ) : null
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {breakdown.map((item) => (
                <div key={item.label} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-2 rounded-full", item.color)} />
                  <div>
                    <dt className="text-sm text-secondary">{item.label}</dt>
                    <dd className="text-base font-semibold tabular-nums">
                      {item.count.toLocaleString()}
                      <span className="ml-1 text-sm font-normal text-secondary">
                        {((item.count / total) * 100).toFixed(0)}%
                      </span>
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Panel>
    </div>
  );
}
