"use client";

import * as React from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { pixel, proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Plus, Search, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill, type StatusTone } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";
import { errorMessage, requestJson } from "@/lib/request";

type ReasonFilter = "all" | "unsubscribed" | "bounced_hard" | "manual";

interface DoNotContactEntry extends Record<string, unknown> {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  reason: "unsubscribed" | "bounced_hard" | "manual";
  campaignId?: string;
  unsubscribeToken?: string;
  createdAt: number;
}

const REASONS: Record<DoNotContactEntry["reason"], { label: string; tone: StatusTone }> = {
  unsubscribed: { label: "Unsubscribed", tone: "neutral" },
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
  const [query, setQuery] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [pendingRemoval, setPendingRemoval] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const { data, error, refetch } = useApi<{ page: DoNotContactEntry[] }>("/api/blocklist");
  const entries: DoNotContactEntry[] = data?.page ?? [];
  const term = query.trim().toLowerCase();
  const filteredEntries = entries.filter(
    (entry) =>
      (activeFilter === "all" || entry.reason === activeFilter) &&
      (!term || entry.email.toLowerCase().includes(term))
  );

  const counts: Record<ReasonFilter, number> = {
    all: entries.length,
    unsubscribed: entries.filter((e) => e.reason === "unsubscribed").length,
    bounced_hard: entries.filter((e) => e.reason === "bounced_hard").length,
    manual: entries.filter((e) => e.reason === "manual").length,
  };

  const columns = React.useMemo<TableColumn<DoNotContactEntry>[]>(
    () => [
      {
        key: "email",
        header: "Email",
        width: proportional(3, { minWidth: 220 }),
        renderCell: (entry) => (
          <Text weight="medium" maxLines={1}>
            {entry.email}
          </Text>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        width: pixel(150),
        renderCell: (entry) => {
          const reason = REASONS[entry.reason] ?? { label: entry.reason, tone: "neutral" as const };
          return <StatusPill tone={reason.tone} label={reason.label} />;
        },
      },
      {
        key: "createdAt",
        header: "Added",
        width: pixel(140),
        renderCell: (entry) => (
          <Timestamp value={new Date(entry.createdAt).toISOString()} format="date" />
        ),
      },
      {
        key: "actions",
        header: "",
        align: "end",
        width: pixel(56),
        renderCell: (entry) => (
          <IconButton
            label={`Remove ${entry.email} from the blocklist`}
            tooltip="Remove"
            variant="ghost"
            size="sm"
            icon={<Icon icon={Trash2} />}
            onClick={() => setPendingRemoval(entry.email)}
          />
        ),
      },
    ],
    []
  );

  const closeAdd = () => {
    if (!isAdding) {
      setShowAddModal(false);
      setNewEmail("");
    }
  };

  const handleAddEntry = async () => {
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
      toast.error(errorMessage(cause, "Couldn't add to the blocklist"));
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
      toast.error(errorMessage(cause, "Couldn't remove the address"));
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
        <Button
          label="Block an address"
          variant="primary"
          icon={<Icon icon={Plus} />}
          onClick={() => setShowAddModal(true)}
        />
      }
    >
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
            label="Filter by reason"
            size="sm"
            value={activeFilter}
            onChange={(value) => setActiveFilter(value as ReasonFilter)}
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
            label="Search the blocklist"
            isLabelHidden
            type="search"
            width={256}
            startIcon={Search}
            hasClear
            value={query}
            onChange={setQuery}
            placeholder="Search by email"
          />
        </HStack>
        <Divider />

        {error && !data ? (
          <ErrorState title="Couldn't load the blocklist" onRetry={refetch} />
        ) : !data ? (
          <RowsSkeleton rows={4} />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={term ? Search : ShieldOff}
            title={
              term
                ? "No addresses match"
                : activeFilter === "all"
                  ? "Nobody is blocked"
                  : "Nothing in this filter"
            }
            description={
              term
                ? `Nothing matches “${query.trim()}”.`
                : activeFilter === "all"
                  ? "Unsubscribes and hard bounces are added here automatically."
                  : "Try another reason."
            }
          />
        ) : (
          <Table data={filteredEntries} columns={columns} idKey="_id" hasHover />
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

      <Dialog
        isOpen={showAddModal}
        onOpenChange={(open) => !open && closeAdd()}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="Block an address"
              subtitle="No campaign will email this address, even if it is imported again."
              onOpenChange={closeAdd}
            />
          }
          content={
            <LayoutContent>
              <TextInput
                label="Email"
                type="email"
                width="100%"
                hasAutoFocus
                isRequired
                placeholder="name@company.com"
                value={newEmail}
                onChange={setNewEmail}
                onEnter={() => void handleAddEntry()}
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="Cancel"
                  variant="secondary"
                  isDisabled={isAdding}
                  onClick={closeAdd}
                />
                <Button
                  label="Block address"
                  variant="primary"
                  isLoading={isAdding}
                  isDisabled={!newEmail.trim()}
                  onClick={() => void handleAddEntry()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Page>
  );
}
