"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mailbox,
  Megaphone,
  Plus,
  Reply,
  Send,
} from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { TimePeriodSelector, type TimePeriod } from "@/components/time-period-selector";
import { buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type OrgStats = {
  totalSent: number;
  estimatedOpenRate: number | null;
  openTrackingEnabled: boolean;
  replyRate: number;
};

type CampaignSummary = {
  _id: string;
  name: string;
  status: string;
  emailsSent: number;
  replyRate: number;
};

export default function DashboardPage() {
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>("30");

  const stats = useApi<OrgStats>(`/api/analytics/org?days=${timePeriod}`);
  const campaigns = useApi<{ campaigns: CampaignSummary[] }>("/api/campaigns");
  const mailboxes = useApi<{ mailboxes: Array<{ status: string }> }>("/api/mailboxes");

  const active =
    campaigns.data?.campaigns?.filter((campaign) => campaign.status === "active").slice(0, 5) ?? [];
  const mailboxList = mailboxes.data?.mailboxes ?? [];
  const activeMailboxCount = mailboxList.filter((mailbox) => mailbox.status === "active").length;
  const statsLoading = stats.isLoading && !stats.data;

  return (
    <Page
      title="Overview"
      description="How your outreach is doing across every campaign and mailbox."
      actions={<TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />}
    >
      {stats.error && !stats.data ? (
        <Panel>
          <ErrorState title="Couldn't load your numbers" onRetry={stats.refetch} />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Emails sent"
            icon={Send}
            isLoading={statsLoading}
            value={stats.data?.totalSent.toLocaleString() ?? "0"}
            hint={`Last ${timePeriod} days`}
          />
          <StatCard
            label="Open rate"
            icon={Eye}
            isLoading={statsLoading}
            value={
              stats.data?.estimatedOpenRate == null
                ? "—"
                : `${stats.data.estimatedOpenRate.toFixed(1)}%`
            }
            hint={stats.data?.estimatedOpenRate == null ? "Open tracking is off" : "Estimated"}
          />
          <StatCard
            label="Reply rate"
            icon={Reply}
            isLoading={statsLoading}
            value={`${stats.data?.replyRate.toFixed(1) ?? "0.0"}%`}
            hint="Replies per email sent"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Active campaigns"
          actions={
            <Link
              href="/dashboard/campaigns"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-accent")}
            >
              View all
            </Link>
          }
        >
          {campaigns.error && !campaigns.data ? (
            <ErrorState title="Couldn't load campaigns" onRetry={campaigns.refetch} />
          ) : campaigns.isLoading && !campaigns.data ? (
            <RowsSkeleton rows={3} />
          ) : active.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No active campaigns"
              description="Launch a campaign and its progress shows up here."
              action={
                <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
                  <Plus data-icon="inline-start" />
                  New campaign
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-base">
                <thead>
                  <tr className="border-b text-left text-sm text-secondary">
                    <th className="px-4 py-2.5 font-medium">Campaign</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                    <th className="px-4 py-2.5 text-right font-medium">Reply rate</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((campaign) => (
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {campaign.replyRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Sending health">
          <div className="flex flex-col gap-3 p-4">
            {mailboxes.error && !mailboxes.data ? (
              <ErrorState
                className="py-6"
                title="Couldn't check mailboxes"
                onRetry={mailboxes.refetch}
              />
            ) : mailboxes.isLoading && !mailboxes.data ? (
              <div className="h-20 animate-pulse rounded-md bg-muted" />
            ) : activeMailboxCount === 0 ? (
              <div className="flex gap-3 rounded-md bg-warning-muted p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="flex flex-col gap-1">
                  <p className="text-base font-medium">No mailbox connected</p>
                  <p className="text-sm text-secondary">
                    Connect a mailbox before you launch a campaign.
                  </p>
                  <Link
                    href="/dashboard/mailboxes"
                    className="mt-1 text-sm font-medium text-accent hover:underline"
                  >
                    Connect a mailbox
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-success-muted text-success">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-medium tabular-nums">
                      {activeMailboxCount} of {mailboxList.length} active
                    </span>
                    <span className="text-sm text-secondary">Mailboxes sending</span>
                  </div>
                </div>
                <Link
                  href="/dashboard/mailboxes"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Mailbox data-icon="inline-start" />
                  Manage
                </Link>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
