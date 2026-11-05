"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Megaphone, Pause, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  const { data, error, refetch } = useApi<{ campaign: any | null }>(`/api/campaigns/${campaignId}`);
  const campaign = data?.campaign;

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = React.useState(false);

  const isLoading = data === undefined;

  const handleResume = async () => {
    setIsUpdating(true);
    try {
      await requestJson(`/api/campaigns/${campaignId}/resume`, { method: "POST" });
      refetch();
      toast.success("Campaign resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resume campaign");
    } finally {
      setIsUpdating(false);
    }
  };

  // Reusable status update handler (DRY - single source of truth)
  const handleStatusChange = async (newStatus: string, actionLabel: string) => {
    setIsUpdating(true);
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
      setIsUpdating(false);
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
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
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
              <Link href="/dashboard/campaigns" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft data-icon="inline-start" />
                Back to campaigns
              </Link>
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
      description={
        <span className="inline-flex items-center gap-2">
          <StatusBadge status={campaign.status} />
        </span>
      }
      breadcrumbs={crumbs}
      actions={
        <>
          {canStop && (
            <Button
              variant="outline"
              onClick={() => setShowCompleteConfirm(true)}
              disabled={isUpdating}
            >
              <CheckCircle data-icon="inline-start" />
              Mark complete
            </Button>
          )}
          {campaign.status === "active" && (
            <Button
              variant="secondary"
              onClick={() => handleStatusChange("paused", "Paused")}
              disabled={isUpdating}
            >
              <Pause data-icon="inline-start" />
              {isUpdating ? "Pausing…" : "Pause"}
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button onClick={handleResume} disabled={isUpdating}>
              <Play data-icon="inline-start" />
              {isUpdating ? "Resuming…" : "Resume"}
            </Button>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
        {[
          { label: "Time zone", value: campaign.schedule.defaultTimezone },
          {
            label: "Send window",
            value: `${campaign.schedule.startTime} – ${campaign.schedule.endTime}`,
          },
          { label: "Days", value: formatDays(campaign.schedule.daysAllowed) },
          {
            label: "Mailboxes",
            value:
              (campaign.mailboxIds?.length ?? 0) === 0 ? (
                <span className="text-warning">None linked</span>
              ) : (
                `${campaign.mailboxIds.length} linked`
              ),
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1 bg-card p-4">
            <dt className="text-sm text-secondary">{item.label}</dt>
            <dd className="text-base font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>

      <CampaignAnalytics campaignId={campaignId} />

      <ContactActivity campaignId={campaignId} />

      <ConfirmDialog
        isOpen={showCompleteConfirm}
        onOpenChange={setShowCompleteConfirm}
        title="Mark this campaign complete?"
        description="Scheduled emails stop and the campaign moves to Completed. This can't be undone."
        confirmText="Mark complete"
        isLoading={isUpdating}
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
