"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Reply, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill, type StatusTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

interface ContactActivityProps {
  campaignId: string;
}

export function ContactActivity({ campaignId }: ContactActivityProps) {
  const router = useRouter();
  const [cursor, setCursor] = React.useState<string | null>(null);

  const {
    data: result,
    error,
    refetch,
  } = useApi<{
    page: any[];
    isDone: boolean;
    continueCursor: string | null;
  }>(`/api/campaigns/${campaignId}/assignments?limit=50`);

  if (error && !result) {
    return (
      <Panel title="Contact activity">
        <ErrorState title="Couldn't load contact activity" onRetry={refetch} />
      </Panel>
    );
  }

  if (result === undefined) {
    return (
      <Panel title="Contact activity">
        <RowsSkeleton rows={4} />
      </Panel>
    );
  }

  const { page: assignments, isDone, continueCursor } = result;

  // Status configuration (DRY - single source of truth)
  const statusConfig: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; tone: StatusTone; label: string }
  > = {
    active: {
      icon: Clock,
      tone: "info",
      label: "In sequence",
    },
    replied: {
      icon: Reply,
      tone: "success",
      label: "Replied",
    },
    bounced: {
      icon: AlertCircle,
      tone: "error",
      label: "Bounced",
    },
    completed: {
      icon: CheckCircle,
      tone: "neutral",
      label: "Completed",
    },
    unsubscribed: {
      icon: Mail,
      tone: "warning",
      label: "Unsubscribed",
    },
  };

  return (
    <Panel
      title="Contact activity"
      description={`${assignments.length} contact${assignments.length !== 1 ? "s" : ""} in this campaign`}
    >
      {assignments.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No contacts assigned"
          description="Add contacts to this campaign to start sending."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-base">
              <thead>
                <tr className="border-b text-sm text-secondary">
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Step</th>
                  <th className="px-4 py-2.5 font-medium">Last email</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment: any) => {
                  const config = statusConfig[assignment.status] || statusConfig.active;

                  return (
                    <tr
                      key={assignment._id}
                      onClick={() => router.push(`/dashboard/contacts/${assignment.contactId}`)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-secondary">
                            {assignment.contactId.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-mono text-sm text-secondary">
                            {assignment.contactId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={config.tone} label={config.label} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-secondary">
                        Step {assignment.currentStep}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {assignment.lastEmailSentAt
                          ? new Date(assignment.lastEmailSentAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Not sent"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isDone && (
            <div className="flex justify-center border-t p-3">
              <Button variant="outline" size="sm" onClick={() => setCursor(continueCursor)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
