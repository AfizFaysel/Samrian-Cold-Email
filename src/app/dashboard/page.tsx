"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { pixel, proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { AlertTriangle, Mailbox, Megaphone, Plus, Reply, Send, UserMinus } from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { TimePeriodSelector, type TimePeriod } from "@/components/time-period-selector";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type OrgStats = {
  totalSent: number;
  replies: number;
  replyRate: number;
  bounceRate: number;
  unsubscribeRate: number;
};

interface CampaignSummary extends Record<string, unknown> {
  _id: string;
  name: string;
  status: string;
  emailsSent: number;
  replyRate: number;
}

type MailboxSummary = { status: string; availableToday: number };

// Cold email rule of thumb: under 2% is healthy, 5% and up puts sending domains at risk.
const BOUNCE_WARN = 2;
const BOUNCE_DANGER = 5;

const CAMPAIGN_COLUMNS: TableColumn<CampaignSummary>[] = [
  {
    key: "name",
    header: "Campaign",
    width: proportional(3, { minWidth: 180 }),
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
    width: pixel(96),
    renderCell: (campaign) => (
      <Text className="tabular-nums">{campaign.emailsSent.toLocaleString()}</Text>
    ),
  },
  {
    key: "replyRate",
    header: "Reply rate",
    align: "end",
    width: pixel(112),
    renderCell: (campaign) => (
      <Text className="tabular-nums">{campaign.replyRate.toFixed(1)}%</Text>
    ),
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>("30");

  const stats = useApi<OrgStats>(`/api/analytics/org?days=${timePeriod}`);
  const campaigns = useApi<{ campaigns: CampaignSummary[] }>("/api/campaigns");
  const mailboxes = useApi<{ mailboxes: MailboxSummary[] }>("/api/mailboxes");
  const inbox = useApi<{ unreadCount: number }>("/api/inbox?limit=1");

  const active =
    campaigns.data?.campaigns?.filter((campaign) => campaign.status === "active").slice(0, 5) ?? [];
  const mailboxList = mailboxes.data?.mailboxes ?? [];
  const activeMailboxes = mailboxList.filter((mailbox) => mailbox.status === "active");
  const disconnected = mailboxList.filter((mailbox) => mailbox.status === "disconnected").length;
  const sendsLeftToday = activeMailboxes.reduce(
    (total, mailbox) => total + mailbox.availableToday,
    0
  );
  const statsLoading = stats.isLoading && !stats.data;
  const bounceRate = stats.data?.bounceRate ?? 0;

  // What to do next, most urgent first. Shown only when something needs the user.
  const attention = [
    mailboxes.data &&
      mailboxList.length === 0 && {
        key: "no-mailbox",
        tone: "error" as const,
        label: "No mailbox connected",
        description: "Campaigns can't send until you connect one.",
        action: { label: "Connect mailbox", href: "/dashboard/mailboxes" },
      },
    disconnected > 0 && {
      key: "disconnected",
      tone: "error" as const,
      label: `${disconnected} mailbox${disconnected === 1 ? " is" : "es are"} disconnected`,
      description: "Sends from it are paused until you reconnect.",
      action: { label: "Reconnect", href: "/dashboard/mailboxes" },
    },
    stats.data &&
      bounceRate >= BOUNCE_DANGER && {
        key: "bounces",
        tone: "error" as const,
        label: `Bounce rate is ${bounceRate.toFixed(1)}%`,
        description: "Above 5% risks your sending domains. Check the list behind recent campaigns.",
        action: { label: "View campaigns", href: "/dashboard/campaigns" },
      },
    (inbox.data?.unreadCount ?? 0) > 0 && {
      key: "replies",
      tone: "accent" as const,
      label: `${inbox.data!.unreadCount} unread repl${inbox.data!.unreadCount === 1 ? "y" : "ies"}`,
      description: "Answer while the conversation is warm.",
      action: { label: "Open inbox", href: "/dashboard/inbox" },
    },
  ].filter((item): item is Exclude<typeof item, false | undefined | null | 0> => Boolean(item));

  return (
    <Page
      title="Overview"
      description="What needs you today, and how your outreach is doing."
      actions={<TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />}
    >
      {attention.length > 0 ? (
        <Panel title="Needs your attention">
          <List hasDividers>
            {attention.map((item) => (
              <ListItem
                key={item.key}
                startContent={<StatusDot variant={item.tone} label={item.label} />}
                label={item.label}
                description={item.description}
                endContent={
                  <Button
                    label={item.action.label}
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(item.action.href)}
                  />
                }
              />
            ))}
          </List>
        </Panel>
      ) : null}

      {stats.error && !stats.data ? (
        <Panel>
          <ErrorState title="Couldn't load your numbers" onRetry={stats.refetch} />
        </Panel>
      ) : (
        <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={4}>
          <StatCard
            label="Emails sent"
            icon={Send}
            isLoading={statsLoading}
            value={stats.data?.totalSent.toLocaleString() ?? "0"}
            hint={`Last ${timePeriod} days`}
          />
          <StatCard
            label="Reply rate"
            icon={Reply}
            isLoading={statsLoading}
            value={`${stats.data?.replyRate.toFixed(1) ?? "0.0"}%`}
            hint={`${(stats.data?.replies ?? 0).toLocaleString()} replies`}
          />
          <StatCard
            label="Bounce rate"
            icon={AlertTriangle}
            isLoading={statsLoading}
            value={
              <span
                className={cn(
                  bounceRate >= BOUNCE_DANGER
                    ? "text-error"
                    : bounceRate >= BOUNCE_WARN && "text-warning"
                )}
              >
                {bounceRate.toFixed(1)}%
              </span>
            }
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
            isLoading={statsLoading}
            value={`${stats.data?.unsubscribeRate.toFixed(1) ?? "0.0"}%`}
            hint="People who opted out"
          />
        </Grid>
      )}

      {/* Main column plus a narrow side column on wide screens, stacked on narrow ones. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Active campaigns"
          actions={
            <Link href="/dashboard/campaigns" isStandalone>
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
                <Button
                  label="New campaign"
                  variant="primary"
                  icon={<Icon icon={Plus} />}
                  onClick={() => router.push("/dashboard/campaigns/new")}
                />
              }
            />
          ) : (
            <Table data={active} columns={CAMPAIGN_COLUMNS} idKey="_id" hasHover />
          )}
        </Panel>

        <Panel
          title="Sending health"
          actions={
            <Button
              label="Manage"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Mailbox} />}
              onClick={() => router.push("/dashboard/mailboxes")}
            />
          }
          bodyClassName="p-4"
        >
          {mailboxes.error && !mailboxes.data ? (
            <ErrorState title="Couldn't check mailboxes" onRetry={mailboxes.refetch} />
          ) : mailboxes.isLoading && !mailboxes.data ? (
            <Skeleton height={96} />
          ) : (
            <MetadataList label={{ position: "top" }}>
              <MetadataListItem label="Mailboxes sending">
                <HStack gap={2} vAlign="center">
                  <StatusDot
                    variant={activeMailboxes.length > 0 ? "success" : "error"}
                    label={activeMailboxes.length > 0 ? "Sending" : "Not sending"}
                  />
                  <Text weight="medium" className="tabular-nums">
                    {activeMailboxes.length} of {mailboxList.length}
                  </Text>
                </HStack>
              </MetadataListItem>
              <MetadataListItem label="Sends left today">
                <Text weight="medium" className="tabular-nums">
                  {sendsLeftToday.toLocaleString()}
                </Text>
              </MetadataListItem>
            </MetadataList>
          )}
        </Panel>
      </div>
    </Page>
  );
}
