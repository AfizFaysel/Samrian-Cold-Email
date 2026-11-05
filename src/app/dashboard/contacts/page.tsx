"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import {
  proportional,
  Table,
  TableSelectionToolbar,
  type TableColumn,
  useTableSelection,
  useTableSelectionState,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { Clock, Layers, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { AddToGroupDialog } from "@/components/add-to-group-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill } from "@/components/status-badge";
import { useApi } from "@/hooks/use-api";
import { errorMessage, requestJson } from "@/lib/request";

interface ContactItem extends Record<string, unknown> {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  customVars: Record<string, unknown> | null;
  timezone?: string;
  bounceStatus?: string;
}

const TIMEZONES = [
  ["America/New_York", "America/New_York (EST/EDT)"],
  ["America/Chicago", "America/Chicago (CST/CDT)"],
  ["America/Denver", "America/Denver (MST/MDT)"],
  ["America/Los_Angeles", "America/Los_Angeles (PST/PDT)"],
  ["Europe/London", "Europe/London (GMT/BST)"],
  ["Europe/Paris", "Europe/Paris (CET/CEST)"],
  ["Asia/Tokyo", "Asia/Tokyo (JST)"],
  ["Asia/Shanghai", "Asia/Shanghai (CST)"],
  ["Australia/Sydney", "Australia/Sydney (AEDT/AEST)"],
] as const;

const PAGE_SIZE = 50;

const nameOf = (contact: ContactItem) =>
  typeof contact.customVars?.name === "string" ? contact.customVars.name : "";

export default function ContactsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showTimezoneModal, setShowTimezoneModal] = React.useState(false);
  const [showGroupModal, setShowGroupModal] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearching = debouncedQuery.trim().length > 0;
  const contactsUrl = isSearching
    ? `/api/contacts?query=${encodeURIComponent(debouncedQuery.trim())}&limit=${PAGE_SIZE}`
    : `/api/contacts?limit=${PAGE_SIZE}`;
  const { data, error, refetch } = useApi<{ contacts: ContactItem[] }>(contactsUrl);
  const contacts = React.useMemo(() => data?.contacts ?? [], [data]);

  const { selectionConfig, selectionState } = useTableSelectionState({
    data: contacts,
    idKey: "_id",
    selectedKeys: selectedIds,
    setSelectedKeys: setSelectedIds,
  });
  const selection = useTableSelection<ContactItem>({
    ...selectionConfig,
    getRowLabel: (contact) => nameOf(contact) || contact.email,
  });

  const columns = React.useMemo<TableColumn<ContactItem>[]>(
    () => [
      {
        key: "contact",
        header: "Contact",
        width: proportional(2, { minWidth: 200 }),
        renderCell: (contact) => {
          const name = nameOf(contact);
          const company = contact.customVars?.company;
          return (
            <HStack gap={3} vAlign="center">
              <Avatar name={name || contact.email} size={32} tooltip={false} />
              <VStack gap={0} className="min-w-0">
                <Link href={`/dashboard/contacts/${contact._id}`} isStandalone>
                  {name || contact.email}
                </Link>
                <Text type="supporting" maxLines={1}>
                  {typeof company === "string" && company ? company : "No company"}
                </Text>
              </VStack>
            </HStack>
          );
        },
      },
      {
        key: "email",
        header: "Email",
        width: proportional(2, { minWidth: 200 }),
        renderCell: (contact) => (
          <Text color="secondary" maxLines={1}>
            {contact.email}
          </Text>
        ),
      },
      {
        key: "timezone",
        header: "Time zone",
        renderCell: (contact) => <Text color="secondary">{contact.timezone || "Not set"}</Text>,
      },
      {
        key: "status",
        header: "Status",
        renderCell: (contact) =>
          contact.bounceStatus === "hard" ? (
            <StatusPill tone="error" label="Hard bounce" />
          ) : contact.bounceStatus === "soft" ? (
            <StatusPill tone="warning" label="Soft bounce" />
          ) : (
            <StatusPill tone="success" label="Deliverable" />
          ),
      },
      {
        key: "actions",
        header: "",
        align: "end",
        renderCell: (contact) => (
          <IconButton
            label={`Delete ${nameOf(contact) || contact.email}`}
            tooltip="Delete"
            variant="ghost"
            size="sm"
            icon={<Icon icon={Trash2} />}
            onClick={() => setPendingDelete([contact._id])}
          />
        ),
      },
    ],
    []
  );

  const handleDelete = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      const deleted = `Deleted ${result.success.length} contact${result.success.length === 1 ? "" : "s"}`;
      if (result.errors.length > 0) toast.warning(`${deleted}. ${result.errors.length} failed.`);
      else toast.success(deleted);
      setSelectedIds(new Set());
      refetch();
    } catch (cause: unknown) {
      toast.error(errorMessage(cause, "Couldn't delete contacts"));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const countLabel = isSearching
    ? `${contacts.length} result${contacts.length === 1 ? "" : "s"}`
    : contacts.length >= PAGE_SIZE
      ? `Showing the latest ${PAGE_SIZE}`
      : `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`;

  return (
    <Page
      title="Contacts"
      description="Everyone you can reach, with their time zone and delivery status."
      actions={
        <Button
          label="Add contacts"
          variant="primary"
          icon={<Icon icon={Plus} />}
          onClick={() => router.push("/dashboard/contacts/import")}
        />
      }
    >
      <Panel>
        {selectionState.hasSelection ? (
          <TableSelectionToolbar
            selection={selectionState}
            clearLabel="Clear"
            size="md"
            startContent={
              <>
                <Button
                  label="Add to group"
                  variant="secondary"
                  icon={<Icon icon={Layers} />}
                  onClick={() => setShowGroupModal(true)}
                />
                <Button
                  label="Set time zone"
                  variant="secondary"
                  icon={<Icon icon={Clock} />}
                  onClick={() => setShowTimezoneModal(true)}
                />
                <Button
                  label="Delete"
                  variant="secondary"
                  icon={<Icon icon={Trash2} />}
                  isDisabled={isDeleting}
                  onClick={() => setPendingDelete(Array.from(selectedIds))}
                />
              </>
            }
          />
        ) : (
          // Same height as the selection toolbar, so selecting a row never shifts the table.
          <HStack
            gap={3}
            hAlign="between"
            vAlign="center"
            wrap="wrap"
            paddingInline={3}
            paddingBlock={2}
          >
            <TextInput
              label="Search contacts"
              isLabelHidden
              type="search"
              width={288}
              startIcon={Search}
              hasClear
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by email"
            />
            {data ? (
              <Text type="supporting" className="tabular-nums">
                {countLabel}
              </Text>
            ) : null}
          </HStack>
        )}
        <Divider />

        {error && !data ? (
          <ErrorState title="Couldn't load contacts" onRetry={refetch} />
        ) : !data ? (
          <RowsSkeleton rows={6} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={isSearching ? Search : Users}
            title={isSearching ? "No contacts match" : "No contacts yet"}
            description={
              isSearching
                ? `Nothing matches “${debouncedQuery.trim()}”. Try part of an email address.`
                : "Import a CSV or add people by hand to start building your list."
            }
            action={
              isSearching ? (
                <Button
                  label="Clear search"
                  variant="secondary"
                  onClick={() => setSearchQuery("")}
                />
              ) : (
                <Button
                  label="Import contacts"
                  variant="primary"
                  icon={<Icon icon={Upload} />}
                  onClick={() => router.push("/dashboard/contacts/import")}
                />
              )
            }
          />
        ) : (
          <Table data={contacts} columns={columns} idKey="_id" hasHover plugins={{ selection }} />
        )}
      </Panel>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} contacts?`
            : "Delete this contact?"
        }
        description="They are removed from every group and campaign. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={() => (pendingDelete ? handleDelete(pendingDelete) : undefined)}
      />

      <AddToGroupDialog
        contactIds={Array.from(selectedIds)}
        isOpen={showGroupModal}
        onOpenChange={setShowGroupModal}
        onAdded={() => setSelectedIds(new Set())}
      />

      <TimezoneDialog
        contactIds={Array.from(selectedIds)}
        isOpen={showTimezoneModal}
        onOpenChange={setShowTimezoneModal}
        onSaved={() => {
          setSelectedIds(new Set());
          refetch();
        }}
      />
    </Page>
  );
}

/** Sets one time zone on the selected contacts; their sends follow its window. */
function TimezoneDialog({
  contactIds,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  contactIds: string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaved: () => void;
}) {
  const [timezone, setTimezone] = React.useState<string>(TIMEZONES[0][0]);
  const [isSaving, setIsSaving] = React.useState(false);
  const count = contactIds.length;

  const close = () => {
    if (!isSaving) onOpenChange(false);
  };

  async function save() {
    setIsSaving(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "PATCH",
        body: JSON.stringify({ ids: contactIds, timezone }),
      });
      if (result.errors.length > 0) {
        toast.warning(`Updated ${result.success.length} contacts. ${result.errors.length} failed.`);
      } else {
        toast.success(`Time zone set for ${result.success.length} contacts`);
      }
      onOpenChange(false);
      onSaved();
    } catch (cause: unknown) {
      toast.error(errorMessage(cause, "Couldn't update contacts"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && close()} purpose="form" width={440}>
      <Layout
        header={
          <DialogHeader
            title="Set time zone"
            subtitle={`Emails to ${count === 1 ? "this contact" : `these ${count} contacts`} follow this time zone's send window.`}
            onOpenChange={close}
          />
        }
        content={
          <LayoutContent>
            <Selector
              label="Time zone"
              width="100%"
              value={timezone}
              onChange={setTimezone}
              options={TIMEZONES.map(([value, label]) => ({ value, label }))}
            />
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" isDisabled={isSaving} onClick={close} />
              <Button
                label="Set time zone"
                variant="primary"
                isLoading={isSaving}
                onClick={() => void save()}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
