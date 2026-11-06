"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { pixel, proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { AlertTriangle, Megaphone, Plus, Reply, Search, Send } from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface CampaignItem extends Record<string, unknown> {
  _id: string;
  name: string;
  status: string;
  _creationTime: number;
  mailboxIds?: string[];
  emailsSent: number;
  replyRate: number;
  bounceRate: number;
}

type CampaignStatus = "all" | "active" | "draft" | "paused" | "completed";

const FILTERS: Array<{ value: CampaignStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

// Same thresholds as Overview and Analytics.
const BOUNCE_WARN = 2;
const BOUNCE_DANGER = 5;

const percent = (value: number) => (value > 0 ? `${value.toFixed(1)}%` : "—");
const bounceTone = (rate: number) =>
  rate >= BOUNCE_DANGER ? "text-error" : rate >= BOUNCE_WARN ? "text-warning" : undefined;

const campaignHref = (campaign: CampaignItem) =>
  campaign.status === "draft"
    ? `/dashboard/campaigns/new/wizard?draft=${campaign._id}`
    : `/dashboard/campaigns/${campaign._id}`;

const COLUMNS: TableColumn<CampaignItem>[] = [
  {
    key: "name",
    header: "Campaign",
    width: proportional(3, { minWidth: 220 }),
    renderCell: (campaign) => (
      <VStack gap={0}>
        <Link href={campaignHref(campaign)} isStandalone>
          {campaign.name}
        </Link>
        <HStack gap={1}>
          <Text type="supporting">Created</Text>
          <Timestamp value={new Date(campaign._creationTime).toISOString()} format="relative" />
        </HStack>
      </VStack>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: pixel(130),
    renderCell: (campaign) => <StatusBadge status={campaign.status} />,
  },
  {
    key: "emailsSent",
    header: "Sent",
    align: "end",
    width: pixel(96),
    renderCell: (campaign) => (
      <Text className="tabular-nums">
        {campaign.emailsSent > 0 ? campaign.emailsSent.toLocaleString() : "—"}
      </Text>
    ),
  },
  {
    key: "replyRate",
    header: "Reply rate",
    align: "end",
    width: pixel(112),
    renderCell: (campaign) => <Text className="tabular-nums">{percent(campaign.replyRate)}</Text>,
  },
  {
    key: "bounceRate",
    header: "Bounce rate",
    align: "end",
    width: pixel(112),
    renderCell: (campaign) => (
      <Text className={cn("tabular-nums", bounceTone(campaign.bounceRate))}>
        {percent(campaign.bounceRate)}
      </Text>
    ),
  },
];

export default function CampaignsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus>("all");

  const campaignsApi = useApi<{ campaigns: CampaignItem[] }>("/api/campaigns");
  const statsApi = useApi<{ totalSent: number; replyRate: number; bounceRate: number }>(
    "/api/analytics/org"
  );
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
  const bounceRate = statsApi.data?.bounceRate ?? 0;
  const filtering = Boolean(searchQuery) || statusFilter !== "all";
  const newCampaign = () => router.push("/dashboard/campaigns/new");

  return (
    <Page
      title="Campaigns"
      description="Sequences you are sending, drafting or have finished."
      actions={
        <Button
          label="New campaign"
          variant="primary"
          icon={<Icon icon={Plus} />}
          onClick={newCampaign}
        />
      }
    >
      <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={4}>
        <StatCard
          label="Active campaigns"
          icon={Megaphone}
          isLoading={campaignsApi.isLoading && !campaigns}
          value={campaigns ? counts.active : "—"}
          hint={campaigns ? `${counts.draft} draft${counts.draft === 1 ? "" : "s"}` : undefined}
        />
        <StatCard
          label="Emails sent"
          icon={Send}
          isLoading={statsLoading}
          value={statsFailed ? "—" : (statsApi.data?.totalSent ?? 0).toLocaleString()}
          hint={statsFailed ? "Couldn't load" : "All time"}
        />
        <StatCard
          label="Reply rate"
          icon={Reply}
          isLoading={statsLoading}
          value={statsFailed ? "—" : percent(statsApi.data?.replyRate ?? 0)}
          hint={statsFailed ? "Couldn't load" : "All time"}
        />
        <StatCard
          label="Bounce rate"
          icon={AlertTriangle}
          isLoading={statsLoading}
          value={
            statsFailed ? (
              "—"
            ) : (
              <span className={bounceTone(bounceRate)}>{percent(bounceRate)}</span>
            )
          }
          hint={statsFailed ? "Couldn't load" : "Aim under 2%"}
        />
      </Grid>

      <Panel>
        <HStack
          gap={3}
          hAlign="between"
          vAlign="center"
          wrap="wrap"
          paddingInline={3}
          paddingBlock={2}
        >
          <SegmentedControl
            label="Filter by status"
            size="sm"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as CampaignStatus)}
          >
            {FILTERS.map((filter) => (
              <SegmentedControlItem
                key={filter.value}
                value={filter.value}
                label={`${filter.label} ${counts[filter.value]}`}
              />
            ))}
          </SegmentedControl>
          <TextInput
            label="Search campaigns"
            isLabelHidden
            type="search"
            width={256}
            startIcon={Search}
            hasClear
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search campaigns"
          />
        </HStack>
        <Divider />

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
                <Button
                  label="Clear filters"
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                />
              ) : (
                <Button
                  label="New campaign"
                  variant="primary"
                  icon={<Icon icon={Plus} />}
                  onClick={newCampaign}
                />
              )
            }
          />
        ) : (
          <Table data={filteredCampaigns} columns={COLUMNS} idKey="_id" hasHover />
        )}
      </Panel>
    </Page>
  );
}
