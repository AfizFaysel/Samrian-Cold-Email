"use client";

import * as React from "react";
import { Mailbox, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { AddMailboxDialog } from "./add-mailbox-dialog";
import { mailboxColumns, type MailboxListItem } from "./columns";

export default function MailboxesPage() {
  const { data, error, refetch } = useApi<{ mailboxes: MailboxListItem[] }>("/api/mailboxes");
  const mailboxes = data?.mailboxes;
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const columns = React.useMemo(() => mailboxColumns(refetch), [refetch]);

  return (
    <Page
      title="Mailboxes"
      description="The email accounts your campaigns send from, with their daily limits."
      actions={
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Connect mailbox
        </Button>
      }
    >
      {error && !data ? (
        <Panel>
          <ErrorState title="Couldn't load mailboxes" onRetry={refetch} />
        </Panel>
      ) : mailboxes === undefined ? (
        <Panel>
          <RowsSkeleton rows={3} />
        </Panel>
      ) : mailboxes.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Mailbox}
            title="No mailboxes connected"
            description="Connect Google, Microsoft 365 or any SMTP account to start sending campaigns."
            action={
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus data-icon="inline-start" />
                Connect mailbox
              </Button>
            }
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={mailboxes}
          searchKey="name"
          searchPlaceholder="Search mailboxes"
        />
      )}

      <AddMailboxDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </Page>
  );
}
