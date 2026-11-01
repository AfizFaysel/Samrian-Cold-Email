"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TimePeriodSelector, type TimePeriod } from "@/components/time-period-selector";
import { Send, Mail, Reply, AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/use-api";

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-plus-jakarta)] text-sm font-semibold text-slate-900">
          {label}
        </h3>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <span className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold leading-none text-slate-900">
        {value}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>("30");

  const { data: orgStats } = useApi<{
    totalSent: number;
    estimatedOpenRate: number | null;
    openTrackingEnabled: boolean;
    replyRate: number;
  }>(`/api/analytics/org?days=${timePeriod}`);
  const { data: campaignData } = useApi<{
    campaigns: Array<{
      _id: string;
      name: string;
      status: string;
      emailsSent: number;
      replyRate: number;
    }>;
  }>("/api/campaigns");
  const { data: mailboxData } = useApi<{
    mailboxes: Array<{ status: string }>;
  }>("/api/mailboxes");
  const recentActivity =
    campaignData?.campaigns?.filter((campaign) => campaign.status === "active").slice(0, 4) ?? [];
  const mailboxes = mailboxData?.mailboxes ?? [];

  const activeMailboxCount = mailboxes.filter((mailbox) => mailbox.status === "active").length;
  const mailboxCount = mailboxes.length;
  const isLoading = orgStats === undefined || campaignData === undefined;

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-ibm-plex)]">
      <PageHeader
        title="Overview"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Overview" }]}
        actions={<TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />}
      />

      <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
        {/* Metric Cards Grid */}
        {isLoading ? (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetricCard
              label="Total Sent"
              value={orgStats?.totalSent.toLocaleString() ?? "0"}
              icon={Send}
            />
            <MetricCard
              label="Open Rate"
              value={
                orgStats?.estimatedOpenRate == null
                  ? "Not tracked"
                  : `${orgStats.estimatedOpenRate.toFixed(1)}%`
              }
              icon={Mail}
            />
            <MetricCard
              label="Reply Rate"
              value={`${orgStats?.replyRate.toFixed(1) ?? "0"}%`}
              icon={Reply}
            />
          </div>
        )}

        {/* Split View: Campaigns & Health */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left: Active Campaigns Table */}
          <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] font-semibold text-slate-900">
                Active Campaigns
              </h3>
              <Link
                href="/dashboard/campaigns"
                className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-[family-name:var(--font-ibm-plex)]">
                      Campaign Name
                    </th>
                    <th className="px-5 py-3 font-[family-name:var(--font-ibm-plex)]">Status</th>
                    <th className="px-5 py-3 text-right font-[family-name:var(--font-ibm-plex)]">
                      Sent
                    </th>
                    <th className="px-5 py-3 text-right font-[family-name:var(--font-ibm-plex)]">
                      Reply Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                          Loading campaigns...
                        </div>
                      </td>
                    </tr>
                  ) : recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                        No active campaigns yet.{" "}
                        <Link
                          href="/dashboard/campaigns"
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          Create your first campaign
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map((campaign) => (
                      <tr
                        key={campaign._id}
                        className="group cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-medium text-slate-900 transition-colors group-hover:text-indigo-600">
                          <Link href={`/dashboard/campaigns/${campaign._id}`}>{campaign.name}</Link>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Running
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-600">
                          {campaign.emailsSent.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-900">
                          {campaign.replyRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: System Health Widget */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:w-[320px]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="font-[family-name:var(--font-plus-jakarta)] font-semibold text-slate-900">
                System Health
              </h3>
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {activeMailboxCount === 0 ? (
                <div className="flex gap-3 items-start rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">No Mailboxes Connected</p>
                    <p className="mt-1 font-mono text-xs text-amber-700">
                      Connect a mailbox to start sending
                    </p>
                    <Link
                      href="/dashboard/mailboxes"
                      className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-600"
                    >
                      Connect Mailbox
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="my-1 h-px w-full bg-slate-200" />
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-sm font-medium text-slate-600">
                        {activeMailboxCount}/{mailboxCount} Mailboxes Active
                      </span>
                    </div>
                    <Link
                      href="/dashboard/mailboxes"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Manage
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
