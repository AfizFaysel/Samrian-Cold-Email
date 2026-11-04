"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Megaphone, Plus, Search, X } from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type CampaignItem = {
  _id: string;
  name: string;
  status: string;
  _creationTime: number;
  mailboxIds?: string[];
  emailsSent: number;
  replyRate: number;
  bounceRate: number;
};

type CampaignStatus = "all" | "active" | "draft" | "paused" | "completed";

const FILTERS: Array<{ value: CampaignStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const percent = (value: number) => (value > 0 ? `${value.toFixed(1)}%` : "—");

export default function CampaignsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus>("all");

  const campaignsApi = useApi<{ campaigns: CampaignItem[] }>("/api/campaigns");
  const statsApi = useApi<{
    totalSent: number;
    estimatedOpenRate: number | null;
    replyRate: number;
  }>("/api/analytics/org");
  const campaigns = campaignsApi.data?.campaigns;

  const filteredCampaigns = React.useMemo(() => {
    if (!campaigns) return [];
    const query = searchQuery.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (statusFilter === "all" || c.status === statusFilter) &&
        (!query || c.name.toLowerCase().includes(query))
    );
  }, [campaigns, statusFilter, searchQuery]);

  const counts = React.useMemo(() => {
    const result: Record<CampaignStatus, number> = {
      all: 0,
      active: 0,
      draft: 0,
      paused: 0,
      completed: 0,
    };
    for (const campaign of campaigns ?? []) {
      result.all += 1;
      if (campaign.status in result) result[campaign.status as CampaignStatus] += 1;
    }
    return result;
  }, [campaigns]);

  const statsLoading = statsApi.isLoading && !statsApi.data;
  const statsFailed = Boolean(statsApi.error) && !statsApi.data;
  const filtering = Boolean(searchQuery) || statusFilter !== "all";

  return (
    <Page
      title="Campaigns"
      description="Sequences you are sending, drafting or have finished."
      actions={
        <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New campaign
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Emails sent"
          isLoading={statsLoading}
          value={statsFailed ? "—" : (statsApi.data?.totalSent ?? 0).toLocaleString()}
          hint={statsFailed ? "Couldn't load" : undefined}
        />
        <StatCard
          label="Open rate"
          isLoading={statsLoading}
          value={
            statsApi.data?.estimatedOpenRate == null
              ? "—"
              : `${statsApi.data.estimatedOpenRate.toFixed(1)}%`
          }
          hint={
            statsFailed
              ? "Couldn't load"
              : statsApi.data?.estimatedOpenRate == null
                ? "Not tracked"
                : undefined
          }
        />
        <StatCard
          label="Reply rate"
          isLoading={statsLoading}
          value={statsFailed ? "—" : percent(statsApi.data?.replyRate ?? 0)}
          hint={statsFailed ? "Couldn't load" : undefined}
        />
        <StatCard
          label="Active campaigns"
          isLoading={campaignsApi.isLoading && !campaigns}
          value={campaigns ? counts.active : "—"}
        />
      </div>

      <Panel>
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-secondary transition-colors hover:text-primary",
                  statusFilter === filter.value && "bg-card text-primary shadow-sm"
                )}
              >
                {filter.label}
                <span className="tabular-nums opacity-60">{counts[filter.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns"
              aria-label="Search campaigns"
              className="pr-8 pl-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-secondary hover:text-primary"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {campaignsApi.error && !campaigns ? (
          <ErrorState title="Couldn't load campaigns" onRetry={campaignsApi.refetch} />
        ) : !campaigns ? (
          <RowsSkeleton rows={4} />
        ) : filteredCampaigns.length === 0 ? (
          <EmptyState
            icon={filtering ? Search : Megaphone}
            title={filtering ? "No campaigns match" : "No campaigns yet"}
            description={
              filtering
                ? "Try another status or search term."
                : "Create a campaign to start reaching out to your contacts."
            }
            action={
              filtering ? (
                <button
                  type="button"
                  className={buttonVariants({ variant: "outline" })}
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
                  <Plus data-icon="inline-start" />
                  New campaign
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-base">
              <thead>
                <tr className="border-b text-left text-sm text-secondary">
                  <th className="px-4 py-2.5 font-medium">Campaign</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reply rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bounce rate</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => {
                  const href =
                    campaign.status === "draft"
                      ? `/dashboard/campaigns/new/wizard?draft=${campaign._id}`
                      : `/dashboard/campaigns/${campaign._id}`;
                  return (
                    <tr
                      key={campaign._id}
                      className="group relative border-b transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={href}
                          className="font-medium after:absolute after:inset-0 group-hover:text-accent"
                        >
                          {campaign.name}
                        </Link>
                        <div className="text-sm text-secondary">
                          Created {relativeTime(campaign._creationTime)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {campaign.emailsSent > 0 ? campaign.emailsSent.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {percent(campaign.replyRate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {percent(campaign.bounceRate)}
                      </td>
                      <td className="px-2 py-3 text-secondary">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}

function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `on ${new Date(timestamp).toLocaleDateString()}`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}
