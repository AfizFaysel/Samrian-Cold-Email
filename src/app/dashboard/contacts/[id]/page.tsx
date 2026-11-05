"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, Clock, Mail, Megaphone, Phone, Plus, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/page-state";
import { ASSIGNMENT_STATUS } from "@/components/campaigns/contact-activity";
import { StatusPill } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";
import { errorMessage, requestJson } from "@/lib/request";

interface CampaignHistoryAssignment extends Record<string, unknown> {
  _id: string;
  _creationTime: number;
  orgId: string;
  campaignId: string;
  campaignName: string | null;
  contactId: string;
  status: string;
  currentStep: number;
  lastEmailSentAt?: number;
}

const HISTORY_COLUMNS: TableColumn<CampaignHistoryAssignment>[] = [
  {
    key: "campaign",
    header: "Campaign",
    width: proportional(2, { minWidth: 180 }),
    renderCell: (row) =>
      row.campaignName ? (
        <Link href={`/dashboard/campaigns/${row.campaignId}`} isStandalone>
          {row.campaignName}
        </Link>
      ) : (
        <Text color="secondary">Deleted campaign</Text>
      ),
  },
  {
    key: "status",
    header: "Status",
    renderCell: (row) => {
      const status = ASSIGNMENT_STATUS[row.status] ?? ASSIGNMENT_STATUS.active;
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

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const { data, error, refetch } = useApi<{
    contact: any | null;
    history: { page: CampaignHistoryAssignment[] };
  }>(`/api/contacts/${contactId}`);
  const contact = data?.contact;
  const history = data?.history?.page ?? [];
  const contactName: string = contact?.customVars?.name || contact?.email || "Contact";
  const crumbs = [{ label: "Contacts", href: "/dashboard/contacts" }, { label: contactName }];

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await requestJson("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ ids: [contactId] }),
      });
      toast.success("Contact deleted");
      router.push("/dashboard/contacts");
    } catch (cause: unknown) {
      toast.error(errorMessage(cause));
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (error && !data) {
    return (
      <Page title="Contact" breadcrumbs={crumbs}>
        <Panel>
          <ErrorState title="Couldn't load this contact" onRetry={refetch} />
        </Panel>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page title="Contact" breadcrumbs={crumbs}>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton height={288} />
          <Skeleton height={288} index={1} />
        </div>
      </Page>
    );
  }

  if (!contact) {
    return (
      <Page title="Contact not found" breadcrumbs={crumbs}>
        <Panel>
          <EmptyState
            icon={UserX}
            title="Contact not found"
            description="It may have been deleted, or it belongs to another workspace."
            action={
              <Button
                label="Back to contacts"
                variant="secondary"
                icon={<Icon icon={ArrowLeft} />}
                onClick={() => router.push("/dashboard/contacts")}
              />
            }
          />
        </Panel>
      </Page>
    );
  }

  const customVars = Object.entries((contact.customVars ?? {}) as Record<string, unknown>);

  return (
    <Page
      title={contactName}
      description={contact.customVars?.company || contact.email}
      breadcrumbs={crumbs}
      actions={
        <>
          <Button
            label="Delete"
            variant="secondary"
            icon={<Icon icon={Trash2} />}
            onClick={() => setConfirmDelete(true)}
          />
          <Button
            label="New campaign"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => router.push("/dashboard/campaigns/new")}
          />
        </>
      }
    >
      {/* Sidebar plus main column on wide screens, stacked on narrow ones. */}
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <VStack gap={4}>
          <Panel title="Details" bodyClassName="p-4">
            <MetadataList label={{ position: "top" }}>
              <MetadataListItem label="Email" icon={<Icon icon={Mail} />}>
                <Text className="wrap-anywhere">{contact.email}</Text>
              </MetadataListItem>
              <MetadataListItem label="Phone" icon={<Icon icon={Phone} />}>
                {contact.customVars?.phone || "Not set"}
              </MetadataListItem>
              <MetadataListItem label="Time zone" icon={<Icon icon={Clock} />}>
                {contact.timezone || "Not set"}
              </MetadataListItem>
              <MetadataListItem label="Delivery">
                {contact.bounceStatus === "hard" ? (
                  <StatusPill tone="error" label="Hard bounce" />
                ) : contact.bounceStatus === "soft" ? (
                  <StatusPill tone="warning" label="Soft bounce" />
                ) : (
                  <StatusPill tone="success" label="Deliverable" />
                )}
              </MetadataListItem>
            </MetadataList>
          </Panel>

          {customVars.length > 0 && (
            <Panel
              title="Merge fields"
              description="Available as {{field}} in your emails."
              bodyClassName="p-4"
            >
              <MetadataList>
                {customVars.map(([key, value]) => (
                  <MetadataListItem key={key} label={key}>
                    <Text className="wrap-anywhere">{String(value)}</Text>
                  </MetadataListItem>
                ))}
              </MetadataList>
            </Panel>
          )}
        </VStack>

        <Panel title="Campaign history">
          {history.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Not in any campaign yet"
              description="When a campaign includes this contact, each step shows up here."
            />
          ) : (
            <Table data={history} columns={HISTORY_COLUMNS} idKey="_id" />
          )}
        </Panel>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this contact?"
        description="They are removed from every group and campaign. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
