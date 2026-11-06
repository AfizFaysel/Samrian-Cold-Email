"use client";

import * as React from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { List, ListItem } from "@astryxdesign/core/List";
import { Popover } from "@astryxdesign/core/Popover";
import { Spinner } from "@astryxdesign/core/Spinner";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { Bell, Check } from "lucide-react";

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
  const [isOpen, setIsOpen] = React.useState(false);
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

  // Opening a notification marks it read and, for a reply, jumps to its conversation.
  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
    }
    const threadId =
      typeof notification.data?.threadId === "string" ? notification.data.threadId : undefined;
    if (notification.type === "reply" && threadId) {
      window.location.href = `/dashboard/inbox?thread=${encodeURIComponent(threadId)}`;
      return;
    }
    await load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await load();
  }

  const unread = data.unreadCount;

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) void load();
      }}
      placement="below"
      alignment="end"
      content={
        <VStack gap={0} width={340}>
          <HStack gap={2} hAlign="between" vAlign="center" paddingInline={4} paddingBlock={3}>
            <Heading level={4}>Notifications</Heading>
            <Button
              label="Mark all read"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Check} />}
              isDisabled={unread === 0}
              onClick={() => void markAllRead()}
            />
          </HStack>
          <Divider />
          {loading && data.notifications.length === 0 ? (
            <VStack hAlign="center" paddingBlock={8}>
              <Spinner label="Loading notifications" />
            </VStack>
          ) : data.notifications.length === 0 ? (
            <VStack
              gap={1}
              hAlign="center"
              paddingInline={4}
              paddingBlock={8}
              className="text-center"
            >
              <Icon icon={Bell} color="secondary" />
              <Text weight="medium">You&apos;re all caught up</Text>
              <Text type="supporting">Replies and alerts will show here.</Text>
            </VStack>
          ) : (
            <VStack gap={0} isScrollable className="max-h-96">
              <List hasDividers>
                {data.notifications.map((notification) => (
                  <ListItem
                    key={notification.id}
                    align="start"
                    onClick={() => void openNotification(notification)}
                    startContent={
                      notification.readAt ? undefined : (
                        <StatusDot variant="accent" label="Unread" />
                      )
                    }
                    label={
                      <Text weight={notification.readAt ? "normal" : "medium"}>
                        {notification.title}
                      </Text>
                    }
                    description={
                      <VStack gap={0.5}>
                        {notification.body ? (
                          <Text type="supporting" maxLines={2}>
                            {notification.body}
                          </Text>
                        ) : null}
                        <Timestamp
                          value={new Date(notification.createdAt).toISOString()}
                          format="relative"
                        />
                      </VStack>
                    }
                  />
                ))}
              </List>
            </VStack>
          )}
        </VStack>
      }
    >
      {/* The count sits on the bell; the button's label carries it for screen readers. */}
      <HStack className="relative">
        <IconButton
          label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          tooltip="Notifications"
          variant="ghost"
          icon={<Icon icon={Bell} />}
        />
        {unread > 0 ? (
          <HStack className="pointer-events-none absolute -top-1 -right-1" aria-hidden>
            <Badge variant="blue" label={unread > 99 ? "99+" : String(unread)} />
          </HStack>
        ) : null}
      </HStack>
    </Popover>
  );
}
