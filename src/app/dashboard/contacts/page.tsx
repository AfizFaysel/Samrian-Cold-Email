"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { StatusPill } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";

type ContactItem = {
  _id: string;
  _creationTime: number;
  orgId: string;
  email: string;
  customVars: any;
  timezone?: string;
  bounceStatus?: string;
};

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

export default function ContactsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showTimezoneModal, setShowTimezoneModal] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null);
  const [timezone, setTimezone] = React.useState("America/New_York");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearching = debouncedQuery.trim().length > 0;
  const contactsUrl = isSearching
    ? `/api/contacts?query=${encodeURIComponent(debouncedQuery.trim())}&limit=${PAGE_SIZE}`
    : `/api/contacts?limit=${PAGE_SIZE}`;
  const { data, error, refetch } = useApi<{ contacts: ContactItem[] }>(contactsUrl);

  const contacts = data?.contacts ?? [];
  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(contacts.map((c) => c._id)));

  const toggleSelect = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDelete = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      if (result.errors.length > 0) {
        toast.warning(
          `Deleted ${result.success.length} contact${result.success.length === 1 ? "" : "s"}. ${result.errors.length} failed.`
        );
      } else {
        toast.success(
          `Deleted ${result.success.length} contact${result.success.length === 1 ? "" : "s"}`
        );
      }
      setSelectedIds(new Set());
      refetch();
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't delete contacts");
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleBulkUpdateTimezone = async () => {
    setIsUpdating(true);
    try {
      const result = await requestJson<{ success: string[]; errors: unknown[] }>("/api/contacts", {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds), timezone }),
      });
      if (result.errors.length > 0) {
        toast.warning(`Updated ${result.success.length} contacts. ${result.errors.length} failed.`);
      } else {
        toast.success(`Time zone set for ${result.success.length} contacts`);
      }
      setSelectedIds(new Set());
      setShowTimezoneModal(false);
      refetch();
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't update contacts");
    } finally {
      setIsUpdating(false);
    }
  };

  const openContact = (id: string) => router.push(`/dashboard/contacts/${id}`);

  return (
    <Page
      title="Contacts"
      description="Everyone you can reach, with their time zone and delivery status."
      actions={
        <Link href="/dashboard/contacts/import" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          Add contacts
        </Link>
      }
    >
      <Panel>
        <div className="flex min-h-14 flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          {selectedIds.size > 0 ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <span className="mr-auto text-base font-medium tabular-nums">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowTimezoneModal(true)}>
                <Clock data-icon="inline-start" />
                Set time zone
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={() => setPendingDelete(Array.from(selectedIds))}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X data-icon="inline-start" />
                Clear
              </Button>
            </div>
          ) : (
            <>
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email"
                  aria-label="Search contacts"
                  className="pr-8 pl-8"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-secondary hover:text-primary"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              {data && (
                <span className="text-sm text-secondary tabular-nums">
                  {isSearching
                    ? `${contacts.length} result${contacts.length === 1 ? "" : "s"}`
                    : contacts.length >= PAGE_SIZE
                      ? `Showing the latest ${PAGE_SIZE}`
                      : `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
                </span>
              )}
            </>
          )}
        </div>

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
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              ) : (
                <Link href="/dashboard/contacts/import" className={buttonVariants()}>
                  <Upload data-icon="inline-start" />
                  Import contacts
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-base">
              <thead>
                <tr className="border-b text-sm text-secondary">
                  <th className="w-10 py-2.5 pl-4">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all contacts"
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Time zone</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const isSelected = selectedIds.has(contact._id);
                  const name = contact.customVars?.name as string | undefined;
                  return (
                    <tr
                      key={contact._id}
                      data-state={isSelected ? "selected" : undefined}
                      className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60 data-[state=selected]:bg-accent-muted"
                      onClick={() => openContact(contact._id)}
                    >
                      <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(contact._id)}
                          aria-label={`Select ${contact.email}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-secondary">
                            {(name || contact.email).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name || "—"}</p>
                            <p className="truncate text-sm text-secondary">
                              {contact.customVars?.company || "No company"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-secondary">{contact.email}</td>
                      <td className="px-4 py-3 text-secondary">{contact.timezone || "Not set"}</td>
                      <td className="px-4 py-3">
                        {contact.bounceStatus === "hard" ? (
                          <StatusPill tone="error" label="Hard bounce" />
                        ) : contact.bounceStatus === "soft" ? (
                          <StatusPill tone="warning" label="Soft bounce" />
                        ) : (
                          <StatusPill tone="success" label="Deliverable" />
                        )}
                      </td>
                      <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-secondary opacity-0 group-hover:opacity-100 hover:text-error focus-visible:opacity-100"
                          aria-label={`Delete ${contact.email}`}
                          onClick={() => setPendingDelete([contact._id])}
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

      <Dialog open={showTimezoneModal} onOpenChange={setShowTimezoneModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set time zone</DialogTitle>
            <DialogDescription>
              Emails to these {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} follow
              this time zone&apos;s send window.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-6 pt-5">
            <Label htmlFor="bulk-timezone">Time zone</Label>
            <NativeSelect
              id="bulk-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex justify-end gap-2 p-6">
            <Button
              variant="outline"
              onClick={() => setShowTimezoneModal(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkUpdateTimezone} disabled={isUpdating}>
              {isUpdating ? "Saving…" : "Set time zone"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
