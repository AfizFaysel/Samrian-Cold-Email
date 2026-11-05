"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, CheckCircle, Megaphone, Pause, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/page-state";
import { StatusBadge, StatusPill } from "@/components/status-badge";
import { toast } from "sonner";
import { CampaignAnalytics } from "@/components/campaigns/campaign-analytics";
import { ContactActivity } from "@/components/campaigns/contact-activity";
import { useApi } from "@/hooks/use-api";
import { requestJson } from "@/lib/request";

interface CampaignDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  // Unwrap params Promise (Next.js 15+ requirement)
  const { id: campaignId } = React.use(params);
  const router = useRouter();

  const { data, error, refetch } = useApi<{ campaign: any | null }>(`/api/campaigns/${campaignId}`);
  const campaign = data?.campaign;

  // Which header action is running, so only that button shows a spinner.
  const [pending, setPending] = React.useState<"pause" | "resume" | "complete" | null>(null);
  const isUpdating = pending !== null;
  const [showCompleteConfirm, setShowCompleteConfirm] = React.useState(false);

  const isLoading = data === undefined;

  const handleResume = async () => {
    setPending("resume");
    try {
      await requestJson(`/api/campaigns/${campaignId}/resume`, { method: "POST" });
      refetch();
      toast.success("Campaign resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resume campaign");
    } finally {
      setPending(null);
    }
  };

  // Reusable status update handler (DRY - single source of truth)
  const handleStatusChange = async (newStatus: "paused" | "completed", actionLabel: string) => {
    setPending(newStatus === "paused" ? "pause" : "complete");
    try {
      await requestJson(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      refetch();
      toast.success(`Campaign ${actionLabel.toLowerCase()} successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to ${actionLabel.toLowerCase()} campaign`
      );
    } finally {
      setPending(null);
    }
  };

  const crumbs = [
    { label: "Campaigns", href: "/dashboard/campaigns" },
    { label: campaign?.name ?? "Campaign" },
  ];

  if (error && !data) {
    return (
      <Page title="Campaign" breadcrumbs={crumbs}>
        <Panel>
          <ErrorState title="Couldn't load this campaign" onRetry={refetch} />
        </Panel>
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page title="Campaign" breadcrumbs={crumbs}>
        <VStack gap={4}>
          <Skeleton height={80} />
          <Skeleton height={288} index={1} />
        </VStack>
      </Page>
    );
  }

  if (!campaign) {
    return (
      <Page title="Campaign not found" breadcrumbs={crumbs}>
        <Panel>
          <EmptyState
            icon={Megaphone}
            title="Campaign not found"
            description="It may have been deleted, or it belongs to another workspace."
            action={
              <Button
                label="Back to campaigns"
                variant="secondary"
                icon={<Icon icon={ArrowLeft} />}
                onClick={() => router.push("/dashboard/campaigns")}
              />
            }
          />
        </Panel>
      </Page>
    );
  }

  const canStop = campaign.status === "active" || campaign.status === "paused";

  return (
    <Page
      title={campaign.name}
      description={<StatusBadge status={campaign.status} />}
      breadcrumbs={crumbs}
      actions={
        <>
          {canStop && (
            <Button
              label="Mark complete"
              variant="secondary"
              icon={<Icon icon={CheckCircle} />}
              isDisabled={isUpdating}
              onClick={() => setShowCompleteConfirm(true)}
            />
          )}
          {campaign.status === "active" && (
            <Button
              label="Pause"
              variant="secondary"
              icon={<Icon icon={Pause} />}
              isLoading={pending === "pause"}
              isDisabled={isUpdating && pending !== "pause"}
              onClick={() => handleStatusChange("paused", "Paused")}
            />
          )}
          {campaign.status === "paused" && (
            <Button
              label="Resume"
              variant="primary"
              icon={<Icon icon={Play} />}
              isLoading={pending === "resume"}
              isDisabled={isUpdating && pending !== "resume"}
              onClick={handleResume}
            />
          )}
        </>
      }
    >
      <Card>
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Time zone">{campaign.schedule.defaultTimezone}</MetadataListItem>
          <MetadataListItem label="Send window">
            {`${campaign.schedule.startTime} – ${campaign.schedule.endTime}`}
          </MetadataListItem>
          <MetadataListItem label="Days">
            {formatDays(campaign.schedule.daysAllowed)}
          </MetadataListItem>
          <MetadataListItem label="Mailboxes">
            {(campaign.mailboxIds?.length ?? 0) === 0 ? (
              <StatusPill tone="warning" label="None linked" />
            ) : (
              `${campaign.mailboxIds.length} linked`
            )}
          </MetadataListItem>
        </MetadataList>
      </Card>

      <CampaignAnalytics campaignId={campaignId} />

      <ContactActivity campaignId={campaignId} />

      <ConfirmDialog
        isOpen={showCompleteConfirm}
        onOpenChange={setShowCompleteConfirm}
        title="Mark this campaign complete?"
        description="Scheduled emails stop and the campaign moves to Completed. This can't be undone."
        confirmText="Mark complete"
        isLoading={pending === "complete"}
        onConfirm={async () => {
          await handleStatusChange("completed", "Completed");
          setShowCompleteConfirm(false);
        }}
      />
    </Page>
  );
}

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDays(days: string[]) {
  if (!days?.length) return "—";
  const short = days.map((day) => day.charAt(0).toUpperCase() + day.slice(1, 3).toLowerCase());
  if (short.length === 5 && DAY_ORDER.slice(0, 5).every((day) => short.includes(day)))
    return "Weekdays";
  if (short.length === 7) return "Every day";
  return DAY_ORDER.filter((day) => short.includes(day)).join(", ");
}
