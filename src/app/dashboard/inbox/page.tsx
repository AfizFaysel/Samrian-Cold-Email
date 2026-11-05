"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Inbox,
  MailOpen,
  RefreshCw,
  Send,
} from "lucide-react";

import { EmptyState, ErrorState, RowsSkeleton } from "@/components/page-state";
import { InboxAttachments, type InboxAttachment } from "@/components/inbox/attachments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="flex h-[calc(100svh-3rem)] min-h-0 flex-col md:h-svh">
      <div className="grid min-h-0 flex-1 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r bg-card",
            selectedId && !mobileList && "max-md:hidden"
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div>
              <h1 className="text-lg font-semibold">Inbox</h1>
              <p className="text-sm text-secondary tabular-nums">
                {data ? `${data.unreadCount} unread` : "Replies from every mailbox"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={refetch}
              aria-label="Refresh"
            >
              <RefreshCw />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
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
              threads.map((thread) => {
                const active = selectedId === thread.id;
                const name = senderLabel(thread.sender);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(thread.id);
                      setMobileList(false);
                      if (thread.unread) void markRead(thread.id);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted",
                      active && "bg-accent-muted hover:bg-accent-muted"
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-secondary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-base",
                            thread.unread ? "font-semibold" : "font-medium"
                          )}
                        >
                          {name}
                        </span>
                        <span className="shrink-0 text-sm text-secondary tabular-nums">
                          {shortTime(thread.receivedAt)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-base",
                            thread.unread ? "text-primary" : "text-secondary"
                          )}
                        >
                          {thread.subject}
                        </span>
                        {thread.unread ? (
                          <span
                            className="ml-auto size-2 shrink-0 rounded-full bg-accent-bg"
                            aria-label="Unread"
                          />
                        ) : null}
                      </span>
                      {thread.excerpt ? (
                        <span className="line-clamp-1 text-sm text-secondary">
                          {thread.excerpt}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            (!selectedId || mobileList) && "max-md:hidden"
          )}
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
              <div className="flex shrink-0 items-start gap-2 border-b bg-card px-4 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-ml-2 md:hidden"
                  onClick={() => setMobileList(true)}
                  aria-label="Back to replies"
                >
                  <ArrowLeft />
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {selectedThread?.subject ?? "Conversation"}
                  </h2>
                  <p className="truncate text-base text-secondary">
                    {selectedThread?.sender?.name
                      ? `${selectedThread.sender.name} <${selectedThread.sender.address ?? "unknown"}>`
                      : (selectedThread?.sender?.address ?? "Unknown sender")}
                  </p>
                  {selectedThread?.sender?.suspicious ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-warning-muted px-2 py-1 text-sm font-medium text-warning">
                      <AlertTriangle className="size-3.5" />
                      The sender&apos;s domain looks unusual. Check it before you reply.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-body px-4 py-5 sm:px-6">
                {threadData === undefined ? (
                  <RowsSkeleton rows={3} />
                ) : (
                  threadData.messages.map((message) => {
                    const sent = message.direction === "sent";
                    return (
                      <article
                        key={message.id}
                        className={cn(
                          "max-w-3xl rounded-lg border px-4 py-3",
                          sent ? "ml-auto border-accent/20 bg-accent-muted" : "bg-card"
                        )}
                      >
                        <header className="mb-2 flex items-center justify-between gap-4 text-sm text-secondary">
                          <span className="font-medium text-primary">
                            {sent ? "You" : (message.from ?? "Sender")}
                          </span>
                          <time className="tabular-nums">
                            {formatTime(message.receivedAt ?? message.sentAt)}
                          </time>
                        </header>
                        <p className="text-base leading-6 whitespace-pre-wrap">
                          {message.displayText}
                        </p>
                        {message.links?.length ? (
                          <div className="mt-3 border-t pt-3">
                            <p className="mb-2 text-sm text-secondary">
                              Links can report clicks to the sender. Check where they go first.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {message.links.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm border bg-card px-2 py-1 text-sm font-medium hover:bg-muted"
                                  title={link.url}
                                >
                                  <span className="truncate">{link.hostname}</span>
                                  <ExternalLink className="size-3 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <InboxAttachments threadId={message.id} attachments={message.attachments} />
                      </article>
                    );
                  })
                )}
              </div>
              <div className="shrink-0 border-t bg-card p-3 sm:p-4">
                {error ? (
                  <p role="alert" className="mb-2 text-base text-error">
                    {error}
                  </p>
                ) : null}
                <div className="rounded-lg border bg-card focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/50">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                        void sendReply();
                    }}
                    placeholder="Write a reply…"
                    aria-label="Reply"
                    className="min-h-24 resize-none border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 pb-2">
                    <span className="text-sm text-secondary max-sm:hidden">
                      Ctrl + Enter to send
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto"
                      onClick={sendReply}
                      disabled={sending || !draft.trim()}
                    >
                      <Send data-icon="inline-start" />
                      {sending ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function shortTime(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "";
}
