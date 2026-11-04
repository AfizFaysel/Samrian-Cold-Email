"use client";

import * as React from "react";
import { Plus, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill, type StatusTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type ReasonFilter = "all" | "unsubscribed" | "bounced_hard" | "manual";

type DoNotContactEntry = {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  reason: "unsubscribed" | "bounced_hard" | "manual";
  campaignId?: string;
  unsubscribeToken?: string;
  createdAt: number;
};

const REASONS: Record<DoNotContactEntry["reason"], { label: string; tone: StatusTone }> = {
  unsubscribed: { label: "Unsubscribed", tone: "warning" },
  bounced_hard: { label: "Hard bounce", tone: "error" },
  manual: { label: "Added by hand", tone: "neutral" },
};

const FILTERS: Array<{ value: ReasonFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced_hard", label: "Bounced" },
  { value: "manual", label: "Manual" },
];

export default function BlocklistPage() {
  const [activeFilter, setActiveFilter] = React.useState<ReasonFilter>("all");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [pendingRemoval, setPendingRemoval] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const { data, error, refetch } = useApi<{ page: DoNotContactEntry[] }>("/api/blocklist");
  const entries: DoNotContactEntry[] = data?.page ?? [];
  const filteredEntries =
    activeFilter === "all" ? entries : entries.filter((entry) => entry.reason === activeFilter);

  const counts: Record<ReasonFilter, number> = {
    all: entries.length,
    unsubscribed: entries.filter((e) => e.reason === "unsubscribed").length,
    bounced_hard: entries.filter((e) => e.reason === "bounced_hard").length,
    manual: entries.filter((e) => e.reason === "manual").length,
  };

  const handleAddEntry = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!newEmail.trim()) return;

    setIsAdding(true);
    try {
      await requestJson("/api/blocklist", {
        method: "POST",
        body: JSON.stringify({ email: newEmail.trim(), reason: "manual" }),
      });
      toast.success(`${newEmail.trim()} won't be contacted`);
      setNewEmail("");
      setShowAddModal(false);
      refetch();
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't add to the blocklist");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    setIsRemoving(true);
    try {
      await requestJson("/api/blocklist", {
        method: "DELETE",
        body: JSON.stringify({ email }),
      });
      toast.success(`${email} removed from the blocklist`);
      refetch();
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't remove the address");
    } finally {
      setIsRemoving(false);
      setPendingRemoval(null);
    }
  };

  return (
    <Page
      title="Blocklist"
      description="Addresses Samrian will never email: unsubscribes, hard bounces and ones you add."
      actions={
        <Button onClick={() => setShowAddModal(true)}>
          <Plus data-icon="inline-start" />
          Block an address
        </Button>
      }
    >
      <Panel>
        <div className="border-b p-3">
          <div
            role="tablist"
            aria-label="Filter by reason"
            className="no-scrollbar flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-secondary transition-colors hover:text-primary",
                  activeFilter === filter.value && "bg-card text-primary shadow-sm"
                )}
              >
                {filter.label}
                <span className="tabular-nums opacity-60">{counts[filter.value]}</span>
              </button>
            ))}
          </div>
        </div>

        {error && !data ? (
          <ErrorState title="Couldn't load the blocklist" onRetry={refetch} />
        ) : !data ? (
          <RowsSkeleton rows={4} />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title={activeFilter === "all" ? "Nobody is blocked" : "Nothing in this filter"}
            description={
              activeFilter === "all"
                ? "Unsubscribes and hard bounces are added here automatically."
                : "Try another reason."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-base">
              <thead>
                <tr className="border-b text-sm text-secondary">
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Reason</th>
                  <th className="px-4 py-2.5 font-medium">Added</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const reason = REASONS[entry.reason] ?? {
                    label: entry.reason,
                    tone: "neutral" as const,
                  };
                  return (
                    <tr
                      key={entry._id}
                      className="group border-b transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3 font-medium">{entry.email}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={reason.tone} label={reason.label} />
                      </td>
                      <td className="px-4 py-3 text-secondary tabular-nums">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-secondary opacity-0 group-hover:opacity-100 hover:text-error focus-visible:opacity-100"
                          aria-label={`Remove ${entry.email} from the blocklist`}
                          onClick={() => setPendingRemoval(entry.email)}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        isOpen={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title="Remove from the blocklist?"
        description={`Campaigns can email ${pendingRemoval ?? "this address"} again.`}
        confirmText="Remove"
        variant="destructive"
        isLoading={isRemoving}
        onConfirm={() => (pendingRemoval ? handleRemove(pendingRemoval) : undefined)}
      />

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddEntry}>
            <DialogHeader>
              <DialogTitle>Block an address</DialogTitle>
              <DialogDescription>
                No campaign will email this address, even if it is imported again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 px-6 pt-5">
              <Label htmlFor="block-email">Email</Label>
              <Input
                id="block-email"
                type="email"
                required
                autoFocus
                placeholder="name@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 p-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding || !newEmail.trim()}>
                {isAdding ? "Blocking…" : "Block address"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json();
}
