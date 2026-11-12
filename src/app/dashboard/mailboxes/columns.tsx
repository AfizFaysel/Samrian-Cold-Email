"use client";

import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { pixel, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { StatusBadge } from "@/components/status-badge";
import { MailboxActions } from "./mailbox-actions";

export interface MailboxListItem extends Record<string, unknown> {
  _id: string;
  name: string;
  provider: "smtp" | "puzzle" | "mailpool" | "google" | "microsoft";
  userEmail?: string;
  username?: string;
  status: "active" | "disconnected" | "limit_reached";
  dailySendLimit: number;
  emailsSentToday: number;
  lastConnectionTestAt?: number;
  lastConnectionError?: string;
  lastTokenRefreshError?: string;
  providerLimitCode?: string;
  rampEnabled: boolean;
  rampStatus: string;
  rampCurrentLimit?: number;
  rampTargetLimit: number;
  timezone?: string;
  rampNextCheckAt?: number;
  rampReason?: string;
  effectiveDailyLimit: number;
  availableToday: number;
}

const readable = (value: string) => {
  const words = value.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft 365",
  smtp: "SMTP",
  mailpool: "Mailpool",
  puzzle: "Puzzle",
};

export const mailboxEmail = (mailbox: MailboxListItem) =>
  mailbox.userEmail || mailbox.username || "";

export const mailboxColumns = (onChanged: () => void): TableColumn<MailboxListItem>[] => [
  {
    key: "name",
    header: "Mailbox",
    width: proportional(2, { minWidth: 180 }),
    renderCell: (mailbox) => (
      <VStack gap={0} className="min-w-0">
        <Text weight="medium" maxLines={1}>
          {mailbox.name}
        </Text>
        <Text type="supporting" maxLines={1}>
          {mailboxEmail(mailbox) || "No address"}
        </Text>
      </VStack>
    ),
  },
  {
    key: "provider",
    width: pixel(120),
    header: "Provider",
    renderCell: (mailbox) => <Text>{PROVIDER_LABELS[mailbox.provider] ?? mailbox.provider}</Text>,
  },
  {
    key: "status",
    width: pixel(120),
    header: "Status",
    renderCell: (mailbox) => <StatusBadge status={mailbox.status} />,
  },
  {
    key: "usage",
    header: "Sent today",
    width: proportional(1, { minWidth: 110 }),
    renderCell: (mailbox) => {
      const limit = mailbox.effectiveDailyLimit;
      const sent = mailbox.emailsSentToday;
      return (
        <ProgressBar
          label="Sent today"
          isLabelHidden
          value={Math.min(sent, limit)}
          max={limit}
          hasValueLabel
          formatValueLabel={() => `${sent} / ${limit}`}
          variant={sent >= limit ? "warning" : "accent"}
        />
      );
    },
  },
  {
    key: "ramp",
    header: "Ramp",
    width: proportional(1, { minWidth: 150 }),
    renderCell: (mailbox) => {
      if (!mailbox.rampEnabled) return <Text type="supporting">Off</Text>;
      const showReason =
        mailbox.rampReason && mailbox.rampReason.toLowerCase() !== mailbox.rampStatus.toLowerCase();
      return (
        <VStack gap={1}>
          <ProgressBar
            label={readable(mailbox.rampStatus)}
            value={mailbox.rampCurrentLimit ?? 5}
            max={mailbox.rampTargetLimit}
            hasValueLabel
            formatValueLabel={(value, max) => `${value} / ${max} a day`}
          />
          {showReason ? <Text type="supporting">{readable(mailbox.rampReason ?? "")}</Text> : null}
          {mailbox.rampNextCheckAt ? (
            <HStack gap={1}>
              <Text type="supporting">Next step</Text>
              <Timestamp value={new Date(mailbox.rampNextCheckAt).toISOString()} format="date" />
            </HStack>
          ) : null}
        </VStack>
      );
    },
  },
  {
    key: "health",
    header: "Health",
    width: proportional(1, { minWidth: 140 }),
    renderCell: (mailbox) => {
      const error =
        mailbox.lastConnectionError ||
        mailbox.lastTokenRefreshError ||
        (mailbox.providerLimitCode ? `Provider limit: ${mailbox.providerLimitCode}` : undefined);
      if (error) {
        return (
          <HStack gap={1.5} vAlign="start">
            <Icon icon="error" color="error" size="sm" label="Problem" />
            <Text type="supporting" maxLines={2}>
              {error}
            </Text>
          </HStack>
        );
      }
      return mailbox.lastConnectionTestAt ? (
        <HStack gap={1}>
          <Text type="supporting">Checked</Text>
          <Timestamp
            value={new Date(mailbox.lastConnectionTestAt).toISOString()}
            format="relative"
          />
        </HStack>
      ) : (
        <Text type="supporting">Not checked</Text>
      );
    },
  },
  {
    key: "actions",
    width: pixel(56),
    header: "",
    align: "end",
    renderCell: (mailbox) => <MailboxActions mailbox={mailbox} onChanged={onChanged} />,
  },
];
