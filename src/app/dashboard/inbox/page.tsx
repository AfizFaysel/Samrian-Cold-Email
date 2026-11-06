"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Kbd } from "@astryxdesign/core/Kbd";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, Inbox, MailOpen, RefreshCw, Send } from "lucide-react";

import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { InboxAttachments, type InboxAttachment } from "@/components/inbox/attachments";
import { useApi } from "@/hooks/use-api";
import { responseError } from "@/lib/request";
import { cn } from "@/lib/utils";

type InboxThread = {
  id: string;
  from?: string;
  sender?: InboxSender;
  subject: string;
  excerpt?: string;
  unread: boolean;
  receivedAt?: number;
};

type InboxMessage = {
  id: string;
  direction?: "sent" | "received";
  from?: string;
  sender?: InboxSender;
  to?: string[];
  subject: string;
  displayText?: string;
  attachments?: InboxAttachment[];
  links?: { url: string; hostname: string }[];
  sentAt?: number;
  receivedAt?: number;
};

type InboxSender = {
  address?: string;
  name?: string;
  suspicious: boolean;
};

type InboxResponse = {
  threads: InboxThread[];
  unreadCount: number;
};

type ThreadResponse = {
  thread: InboxThread;
  messages: InboxMessage[];
};

export default function InboxPage() {
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread") ?? undefined;
  const { data, error: listError, refetch } = useApi<InboxResponse>("/api/inbox?limit=50");
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  // On phones only one pane shows; the list comes first even after a thread auto-selects.
  const [mobileList, setMobileList] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const threadUrl = selectedId ? `/api/inbox/threads/${selectedId}` : "";
  const {
    data: threadData,
    error: threadError,
    refetch: refetchThread,
  } = useApi<ThreadResponse>(threadUrl);

  const threads = data?.threads ?? [];
  const selectedThread = threadData?.thread;

  React.useEffect(() => {
    if (requestedThreadId && requestedThreadId !== selectedId) {
      setSelectedId(requestedThreadId);
      return;
    }
    if (!selectedId && threads[0]) setSelectedId(threads[0].id);
  }, [requestedThreadId, selectedId, threads]);

  async function markRead(id: string) {
    await fetch(`/api/inbox/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    refetch();
    refetchThread();
  }

  // Kept across retries so an uncertain send cannot be repeated as a new reply.
  const replyRequestId = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    replyRequestId.current = undefined;
  }, [selectedId]);

  async function sendReply() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/inbox/threads/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          clientRequestId: (replyRequestId.current ??= crypto.randomUUID()),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      replyRequestId.current = undefined;
      setDraft("");
      refetchThread();
      refetch();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  const senderLabel = (sender?: InboxSender) => sender?.name ?? sender?.address ?? "Unknown sender";

  return (
    // Fills the shell's content area. Two panes on desktop, one at a time on phones.
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[340px_minmax(0,1fr)]">
        <VStack
          as="aside"
          gap={0}
          className={cn("min-h-0 border-r", selectedId && !mobileList && "max-md:hidden")}
        >
          <HStack gap={2} hAlign="between" vAlign="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0}>
              <Heading level={1}>Inbox</Heading>
              <Text type="supporting" className="tabular-nums">
                {data ? `${data.unreadCount} unread` : "Replies from every mailbox"}
              </Text>
            </VStack>
            <IconButton
              label="Refresh replies"
              tooltip="Refresh"
              variant="ghost"
              icon={<Icon icon={RefreshCw} />}
              onClick={refetch}
            />
          </HStack>
          <Divider />
          <VStack
            gap={0}
            isScrollable
            paddingInline={2}
            paddingBlock={2}
            className="min-h-0 flex-1"
          >
            {listError && !data ? (
              <ErrorState title="Couldn't load replies" onRetry={refetch} />
            ) : data === undefined ? (
              <RowsSkeleton rows={6} />
            ) : threads.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No replies yet"
                description="When someone answers a campaign email, the conversation lands here."
              />
            ) : (
              <List hasDividers>
                {threads.map((thread) => {
                  const name = senderLabel(thread.sender);
                  return (
                    <ListItem
                      key={thread.id}
                      align="start"
                      isSelected={selectedId === thread.id}
                      onClick={() => {
                        setSelectedId(thread.id);
                        setMobileList(false);
                        if (thread.unread) void markRead(thread.id);
                      }}
                      startContent={<Avatar name={name} size={32} tooltip={false} />}
                      label={
                        <Text weight={thread.unread ? "semibold" : "medium"} maxLines={1}>
                          {name}
                        </Text>
                      }
                      description={
                        <VStack gap={0.5}>
                          <Text color={thread.unread ? "primary" : "secondary"} maxLines={1}>
                            {thread.subject}
                          </Text>
                          {thread.excerpt ? (
                            <Text type="supporting" maxLines={1}>
                              {thread.excerpt}
                            </Text>
                          ) : null}
                        </VStack>
                      }
                      endContent={
                        <VStack gap={1} hAlign="end">
                          {thread.receivedAt ? (
                            <Timestamp value={isoTime(thread.receivedAt)} format="relative_short" />
                          ) : null}
                          {thread.unread ? <StatusDot variant="accent" label="Unread" /> : null}
                        </VStack>
                      }
                    />
                  );
                })}
              </List>
            )}
          </VStack>
        </VStack>

        <VStack
          as="section"
          gap={0}
          className={cn("min-h-0 min-w-0", (!selectedId || mobileList) && "max-md:hidden")}
        >
          {!selectedId ? (
            <EmptyState
              className="flex-1"
              icon={MailOpen}
              title="Pick a conversation"
              description="Choose a reply on the left to read it and answer."
            />
          ) : threadError && !threadData ? (
            <ErrorState
              className="flex-1"
              title="Couldn't open this conversation"
              onRetry={refetchThread}
            />
          ) : (
            <>
              <VStack gap={3} paddingInline={6} paddingBlock={3}>
                <HStack gap={2} vAlign="start">
                  <HStack className="md:hidden">
                    <IconButton
                      label="Back to replies"
                      variant="ghost"
                      icon={<Icon icon={ArrowLeft} />}
                      onClick={() => setMobileList(true)}
                    />
                  </HStack>
                  <VStack gap={0} className="min-w-0">
                    <Heading level={2}>{selectedThread?.subject ?? "Conversation"}</Heading>
                    <Text type="supporting" maxLines={1}>
                      {selectedThread?.sender?.name
                        ? `${selectedThread.sender.name} <${selectedThread.sender.address ?? "unknown"}>`
                        : (selectedThread?.sender?.address ?? "Unknown sender")}
                    </Text>
                  </VStack>
                </HStack>
                {selectedThread?.sender?.suspicious ? (
                  <Banner
                    status="warning"
                    title="Check this sender before you reply"
                    description="Their domain looks unusual for the name they use."
                  />
                ) : null}
              </VStack>
              <Divider />
              <VStack
                gap={3}
                isScrollable
                paddingInline={6}
                paddingBlock={5}
                className="min-h-0 flex-1"
              >
                {threadData === undefined ? (
                  <RowsSkeleton rows={3} />
                ) : (
                  threadData.messages.map((message) => {
                    const sent = message.direction === "sent";
                    const time = message.receivedAt ?? message.sentAt;
                    return (
                      <Card
                        key={message.id}
                        variant={sent ? "blue" : "default"}
                        maxWidth={768}
                        className={cn("w-full min-w-0 shrink-0", sent && "ml-auto")}
                      >
                        <VStack as="article" gap={2}>
                          <HStack gap={4} hAlign="between" vAlign="center">
                            <Text weight="medium" maxLines={1}>
                              {sent ? "You" : (message.from ?? "Sender")}
                            </Text>
                            {time ? <Timestamp value={isoTime(time)} format="date_time" /> : null}
                          </HStack>
                          {/* Emails carry long unbroken URLs and tokens: wrap anywhere, never overflow. */}
                          <Text className="whitespace-pre-wrap wrap-anywhere">
                            {message.displayText}
                          </Text>
                          {message.links?.length ? (
                            <VStack gap={2}>
                              <Divider />
                              <Text type="supporting">
                                Links can report clicks to the sender. Check where they go first.
                              </Text>
                              <HStack gap={3} wrap="wrap">
                                {message.links.map((link) => (
                                  <Link key={link.url} href={link.url} isExternalLink isStandalone>
                                    {link.hostname}
                                  </Link>
                                ))}
                              </HStack>
                            </VStack>
                          ) : null}
                          <InboxAttachments
                            threadId={message.id}
                            attachments={message.attachments}
                          />
                        </VStack>
                      </Card>
                    );
                  })
                )}
              </VStack>
              <Divider />
              <VStack
                as="form"
                gap={2}
                padding={4}
                onSubmit={(event: React.FormEvent) => {
                  event.preventDefault();
                  void sendReply();
                }}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void sendReply();
                }}
              >
                {error ? <Banner status="error" title={error} /> : null}
                <TextArea
                  label="Reply"
                  isLabelHidden
                  width="100%"
                  rows={4}
                  value={draft}
                  onChange={setDraft}
                  placeholder="Write a reply…"
                />
                <HStack gap={2} hAlign="end" vAlign="center">
                  <HStack gap={1.5} vAlign="center" className="mr-auto max-sm:hidden">
                    <Kbd keys="mod+enter" />
                    <Text type="supporting">to send</Text>
                  </HStack>
                  <Button
                    label="Send reply"
                    variant="primary"
                    size="sm"
                    icon={<Icon icon={Send} />}
                    isLoading={sending}
                    isDisabled={!draft.trim()}
                    type="submit"
                  />
                </HStack>
              </VStack>
            </>
          )}
        </VStack>
      </div>
    </div>
  );
}

function isoTime(value: number) {
  return new Date(value).toISOString();
}
