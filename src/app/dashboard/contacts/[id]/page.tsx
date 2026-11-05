"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Mail, Megaphone, Phone, Plus, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/page-state";
import { StatusBadge, StatusPill } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { errorMessage, requestJson } from "@/lib/request";

type CampaignHistoryAssignment = {
  _id: string;
  _creationTime: number;
  orgId: string;
  campaignId: string;
  contactId: string;
  status: string;
  currentStep: number;
  lastEmailSentAt?: number;
};

const HISTORY_STATUS: Record<string, string> = {
  active: "running",
  replied: "replied",
  bounced: "bounced",
  completed: "completed",
  unsubscribed: "unsubscribed",
};

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
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
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
              <Link href="/dashboard/contacts" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft data-icon="inline-start" />
                Back to contacts
              </Link>
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
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
          <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            New campaign
          </Link>
        </>
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Details">
            <dl className="flex flex-col gap-4 p-4">
              {[
                { icon: Mail, label: "Email", value: contact.email },
                { icon: Phone, label: "Phone", value: contact.customVars?.phone || "—" },
                { icon: Clock, label: "Time zone", value: contact.timezone || "Not set" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-secondary" />
                  <div className="min-w-0">
                    <dt className="text-sm text-secondary">{label}</dt>
                    <dd className="truncate text-base font-medium">{String(value)}</dd>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-4">
                <dt className="text-sm text-secondary">Delivery</dt>
                <dd>
                  {contact.bounceStatus === "hard" ? (
                    <StatusPill tone="error" label="Hard bounce" />
                  ) : contact.bounceStatus === "soft" ? (
                    <StatusPill tone="warning" label="Soft bounce" />
                  ) : (
                    <StatusPill tone="success" label="Deliverable" />
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          {customVars.length > 0 && (
            <Panel title="Merge fields" description="Available as {{field}} in your emails.">
              <dl className="divide-y">
                {customVars.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="font-mono text-sm text-secondary">{key}</dt>
                    <dd className="text-right text-base break-all">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
        </div>

        <Panel title="Campaign history">
          {history.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Not in any campaign yet"
              description="When a campaign includes this contact, each step shows up here."
            />
          ) : (
            <ol className="flex flex-col">
              {history.map((assignment) => (
                <li
                  key={assignment._id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusBadge status={HISTORY_STATUS[assignment.status] ?? assignment.status} />
                    <Link
                      href={`/dashboard/campaigns/${assignment.campaignId}`}
                      className="truncate text-base font-medium hover:text-accent"
                    >
                      Campaign {assignment.campaignId.slice(0, 8)}
                    </Link>
                    <span className="text-sm text-secondary tabular-nums">
                      Step {assignment.currentStep}
                    </span>
                  </div>
                  <span className="text-sm text-secondary tabular-nums">
                    {new Date(
                      assignment.lastEmailSentAt ?? assignment._creationTime
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ol>
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
