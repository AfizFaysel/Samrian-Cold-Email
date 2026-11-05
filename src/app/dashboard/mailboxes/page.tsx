"use client";

import * as React from "react";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Table } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Mailbox, Plus, Search } from "lucide-react";
import { Page, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { useApi } from "@/hooks/use-api";
import { AddMailboxDialog } from "./add-mailbox-dialog";
import { mailboxColumns, mailboxEmail, type MailboxListItem } from "./columns";

export default function MailboxesPage() {
  const { data, error, refetch } = useApi<{ mailboxes: MailboxListItem[] }>("/api/mailboxes");
  const mailboxes = data?.mailboxes;
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const columns = React.useMemo(() => mailboxColumns(refetch), [refetch]);

  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return mailboxes ?? [];
    return (mailboxes ?? []).filter((mailbox) =>
      `${mailbox.name} ${mailboxEmail(mailbox)}`.toLowerCase().includes(term)
    );
  }, [mailboxes, query]);

  const connectButton = (
    <Button
      label="Connect mailbox"
      variant="primary"
      icon={<Icon icon={Plus} />}
      onClick={() => setIsAddDialogOpen(true)}
    />
  );

  return (
    <Page
      title="Mailboxes"
      description="The email accounts your campaigns send from, with their daily limits."
      actions={connectButton}
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
            action={connectButton}
          />
        </Panel>
      ) : (
        <Panel>
          <HStack
            gap={3}
            hAlign="between"
            vAlign="center"
            wrap="wrap"
            paddingInline={3}
            paddingBlock={2}
          >
            <TextInput
              label="Search mailboxes"
              isLabelHidden
              type="search"
              width={288}
              startIcon={Search}
              hasClear
              value={query}
              onChange={setQuery}
              placeholder="Search by name or address"
            />
            <Text type="supporting" className="tabular-nums">
              {visible.length} of {mailboxes.length}
            </Text>
          </HStack>
          <Divider />
          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No mailboxes match"
              description={`Nothing matches “${query.trim()}”.`}
              action={
                <Button label="Clear search" variant="secondary" onClick={() => setQuery("")} />
              }
            />
          ) : (
            <Table data={visible} columns={columns} idKey="_id" verticalAlign="top" />
          )}
        </Panel>
      )}

      <AddMailboxDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onConnected={refetch}
      />
    </Page>
  );
}
