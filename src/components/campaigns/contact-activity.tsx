"use client";

import * as React from "react";
import { Avatar } from "@astryxdesign/core/Avatar";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { Mail } from "lucide-react";
import { Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill, type StatusTone } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";

interface ContactActivityProps {
  campaignId: string;
}

interface AssignmentRow extends Record<string, unknown> {
  _id: string;
  contactId: string;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  currentStep: number;
  lastEmailSentAt?: number;
}

// Labels match the "Where contacts are" breakdown above this table.
const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: "info", label: "In sequence" },
  replied: { tone: "success", label: "Replied" },
  bounced: { tone: "error", label: "Bounced" },
  completed: { tone: "neutral", label: "Finished" },
  unsubscribed: { tone: "warning", label: "Unsubscribed" },
};

const COLUMNS: TableColumn<AssignmentRow>[] = [
  {
    key: "contact",
    header: "Contact",
    width: proportional(2, { minWidth: 220 }),
    renderCell: (row) => {
      const title = row.contactName || row.contactEmail || "Deleted contact";
      return (
        <HStack gap={3} vAlign="center">
          <Avatar name={title} size={32} tooltip={false} />
          <VStack gap={0} className="min-w-0">
            {row.contactEmail ? (
              <Link href={`/dashboard/contacts/${row.contactId}`} isStandalone>
                {title}
              </Link>
            ) : (
              <Text color="secondary">{title}</Text>
            )}
            {row.contactName && row.contactEmail ? (
              <Text type="supporting" maxLines={1}>
                {row.contactEmail}
              </Text>
            ) : null}
          </VStack>
        </HStack>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    renderCell: (row) => {
      const status = STATUS[row.status] ?? STATUS.active;
      return <StatusPill tone={status.tone} label={status.label} />;
    },
  },
  {
    key: "progress",
    header: "Progress",
    renderCell: (row) => (
      <Text color="secondary" className="tabular-nums">
        {row.currentStep > 0 ? `Step ${row.currentStep} sent` : "Not started"}
      </Text>
    ),
  },
  {
    key: "lastEmail",
    header: "Last email",
    renderCell: (row) =>
      row.lastEmailSentAt ? (
        <Timestamp value={new Date(row.lastEmailSentAt).toISOString()} format="date" />
      ) : (
        <Text color="secondary">Not sent</Text>
      ),
  },
];

export function ContactActivity({ campaignId }: ContactActivityProps) {
  const {
    data: result,
    error,
    refetch,
  } = useApi<{ page: AssignmentRow[] }>(`/api/campaigns/${campaignId}/assignments?limit=50`);

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

  const assignments = result.page;

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
        <Table data={assignments} columns={COLUMNS} idKey="_id" hasHover />
      )}
    </Panel>
  );
}
