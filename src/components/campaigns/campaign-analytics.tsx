"use client";

import * as React from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
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

  // Bar segment color and StatusDot variant name the same semantic token.
  const breakdown = [
    { label: "In sequence", count: stats?.activeContacts ?? 0, dot: "accent", bar: "bg-accent-bg" },
    { label: "Replied", count: stats?.repliedContacts ?? 0, dot: "success", bar: "bg-success" },
    { label: "Bounced", count: stats?.bouncedContacts ?? 0, dot: "error", bar: "bg-error" },
    {
      label: "Finished",
      count: stats?.completedContacts ?? 0,
      dot: "neutral",
      bar: "bg-secondary",
    },
  ] as const;
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <VStack gap={4}>
      <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={4}>
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
      </Grid>

      <Panel title="Where contacts are" bodyClassName="p-4">
        {loading ? (
          <Skeleton height={10} radius="rounded" />
        ) : total === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts assigned yet"
            description="Contacts appear here once the campaign assigns them."
          />
        ) : (
          <VStack gap={4}>
            {/* Stacked share bar: Astryx ProgressBar shows one value, so segments are drawn here. */}
            <HStack
              gap={0.5}
              role="img"
              aria-label={breakdown.map((item) => `${item.label} ${item.count}`).join(", ")}
              className="h-2.5 w-full overflow-hidden rounded-full"
            >
              {breakdown.map((item) =>
                item.count > 0 ? (
                  <span
                    key={item.label}
                    className={cn(item.bar, "h-full transition-all duration-300")}
                    style={{ width: `${(item.count / total) * 100}%` }}
                  />
                ) : null
              )}
            </HStack>
            <Grid columns={{ minWidth: 140, repeat: "fit" }} gap={4}>
              {breakdown.map((item) => (
                <VStack key={item.label} gap={0.5}>
                  <HStack gap={2} vAlign="center">
                    <StatusDot variant={item.dot} label={item.label} />
                    <Text type="supporting">{item.label}</Text>
                  </HStack>
                  <HStack gap={1} vAlign="end">
                    <Text weight="semibold" className="tabular-nums">
                      {item.count.toLocaleString()}
                    </Text>
                    <Text type="supporting" className="tabular-nums">
                      {((item.count / total) * 100).toFixed(0)}%
                    </Text>
                  </HStack>
                </VStack>
              ))}
            </Grid>
          </VStack>
        )}
      </Panel>
    </VStack>
  );
}
