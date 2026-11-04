"use client";

import * as React from "react";
import { Bell, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: number;
  createdAt: number;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function NotificationsBell() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<NotificationResponse>({
    notifications: [],
    unreadCount: 0,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=10");
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setData((await response.json()) as NotificationResponse);
    } catch {
      // The bell is secondary: keep the last known list rather than break the header.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    await load();
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) await markRead(notification.id);
    const threadId =
      typeof notification.data?.threadId === "string" ? notification.data.threadId : undefined;
    if (notification.type === "reply" && threadId) {
      window.location.href = `/dashboard/inbox?thread=${encodeURIComponent(threadId)}`;
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await load();
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void load();
      }}
    >
      <DropdownMenuTrigger
        type="button"
        className="relative inline-flex size-8 items-center justify-center rounded-md text-secondary outline-none hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {data.unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-bg px-1 text-xs font-semibold text-on-accent tabular-nums ring-2 ring-background">
            {data.unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-primary">Notifications</h2>
          <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
            <Check data-icon="inline-start" />
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : data.notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <Bell className="size-5 text-secondary" />
              <p className="text-base font-medium">You&apos;re all caught up</p>
              <p className="text-sm text-secondary">Replies and alerts will show here.</p>
            </div>
          ) : (
            data.notifications.map((notification) => (
              <div
                key={notification.id}
                className="relative border-b border-border px-4 py-3 last:border-0 hover:bg-muted/60"
              >
                {!notification.readAt ? (
                  <span
                    className="absolute top-4.5 left-1.5 size-1.5 rounded-full bg-accent-bg"
                    aria-label="Unread"
                  />
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-base font-medium text-primary">{notification.title}</p>
                    {notification.body ? (
                      <p className="mt-1 text-sm text-secondary">{notification.body}</p>
                    ) : null}
                  </button>
                  {!notification.readAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
