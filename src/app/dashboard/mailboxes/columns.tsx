"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { MailboxActions } from "./mailbox-actions";

export type MailboxListItem = {
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
  rampNextCheckAt?: number;
  rampReason?: string;
  effectiveDailyLimit: number;
  availableToday: number;
};

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

export const mailboxColumns = (onChanged: () => void): ColumnDef<MailboxListItem>[] => [
  {
    accessorKey: "name",
    header: () => <div className="text-sm font-medium text-secondary">Mailbox</div>,
    cell: ({ row }) => {
      const email = row.original.userEmail || row.original.username;
      return (
        <div className="min-w-0">
          <div className="font-medium text-primary">{row.getValue("name")}</div>
          <div className="text-sm text-secondary">{email || "—"}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "provider",
    header: () => <div className="text-sm font-medium text-secondary">Provider</div>,
    cell: ({ row }) => {
      const provider = row.getValue("provider") as string;
      return <div className="text-base text-primary">{PROVIDER_LABELS[provider] ?? provider}</div>;
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-sm font-medium text-secondary">Status</div>,
    cell: ({ row }) => {
      const status = row.getValue("status") as any;
      return <StatusBadge status={status} />;
    },
  },
  {
    id: "ramp",
    header: () => <div className="text-sm font-medium text-secondary">Ramp</div>,
    cell: ({ row }) => {
      const mailbox = row.original;
      if (!mailbox.rampEnabled) return <Text type="supporting">Off</Text>;
      const current = mailbox.rampCurrentLimit ?? 5;
      return (
        <div className="flex w-36 flex-col gap-1">
          <ProgressBar
            label={readable(mailbox.rampStatus)}
            value={current}
            max={mailbox.rampTargetLimit}
            hasValueLabel
            formatValueLabel={(value, max) => `${value} / ${max} a day`}
          />
          {mailbox.rampReason &&
          mailbox.rampReason.toLowerCase() !== mailbox.rampStatus.toLowerCase() ? (
            <Text type="supporting">{mailbox.rampReason}</Text>
          ) : null}
          {mailbox.rampNextCheckAt ? (
            <Text type="supporting">
              Next step {new Date(mailbox.rampNextCheckAt).toLocaleDateString()}
            </Text>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "usage",
    header: () => <div className="text-sm font-medium text-secondary">Sent today</div>,
    cell: ({ row }) => {
      const limit = row.original.effectiveDailyLimit;
      const sent = row.original.emailsSentToday;
      return (
        <div className="w-28">
          <ProgressBar
            label="Sent today"
            isLabelHidden
            value={Math.min(sent, limit)}
            max={limit}
            hasValueLabel
            formatValueLabel={() => `${sent} / ${limit}`}
            variant={sent >= limit ? "warning" : "accent"}
          />
        </div>
      );
    },
  },
  {
    id: "health",
    header: () => <div className="text-sm font-medium text-secondary">Health</div>,
    cell: ({ row }) => {
      const mailbox = row.original;
      const error =
        mailbox.lastConnectionError ||
        mailbox.lastTokenRefreshError ||
        (mailbox.providerLimitCode ? `Provider limit: ${mailbox.providerLimitCode}` : undefined);
      if (error) {
        return (
          <div className="flex max-w-48 items-start gap-1.5">
            <Icon icon="error" color="error" size="sm" label="Problem" />
            <Text type="supporting">{error}</Text>
          </div>
        );
      }
      return (
        <Text type="supporting">
          {mailbox.lastConnectionTestAt
            ? `Checked ${new Date(mailbox.lastConnectionTestAt).toLocaleDateString()}`
            : "Not checked"}
        </Text>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <MailboxActions mailbox={row.original} onChanged={onChanged} />,
  },
];
