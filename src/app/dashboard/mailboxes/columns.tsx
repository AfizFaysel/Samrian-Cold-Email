"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Activity, Gauge, MoreHorizontal, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft 365",
  smtp: "SMTP",
  mailpool: "Mailpool",
  puzzle: "Puzzle",
};

export const columns: ColumnDef<MailboxListItem>[] = [
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
      if (!mailbox.rampEnabled) return <span className="text-sm text-secondary">Off</span>;
      return (
        <div className="min-w-[120px] text-sm">
          <p className="font-medium capitalize text-primary">
            {mailbox.rampStatus.replace("-", " ")}
          </p>
          <p className="mt-1 text-secondary">
            {mailbox.rampCurrentLimit ?? 5} / {mailbox.rampTargetLimit} daily
          </p>
          <Progress
            value={((mailbox.rampCurrentLimit ?? 5) / mailbox.rampTargetLimit) * 100}
            className="mt-1.5 h-1.5"
          />
          {mailbox.rampReason ? <p className="mt-1 text-secondary">{mailbox.rampReason}</p> : null}
          {mailbox.rampNextCheckAt ? (
            <p className="mt-1 text-secondary">
              Next {new Date(mailbox.rampNextCheckAt).toLocaleDateString()}
            </p>
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
      const percentage = limit > 0 ? (sent / limit) * 100 : 0;

      return (
        <div className="w-[120px] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-primary">{sent}</span>
            <span className="text-secondary">/ {limit}</span>
          </div>
          <Progress value={percentage} className="h-1.5" />
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
      return (
        <div className="max-w-[220px] text-sm">
          {error ? (
            <span className="text-error">{error}</span>
          ) : mailbox.lastConnectionTestAt ? (
            <span className="text-secondary">
              Checked {new Date(mailbox.lastConnectionTestAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-secondary">Not checked</span>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const mailbox = row.original;
      const checkMailbox = async () => {
        const response = await fetch(`/api/mailboxes/${mailbox._id}/check`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Mailbox check failed");
        toast.success(result.status === "healthy" ? "Mailbox healthy" : result.issue);
        window.location.reload();
      };
      const reconnectMailbox = async () => {
        const response = await fetch(`/api/mailboxes/${mailbox._id}/reconnect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Reconnect failed");
        if (result.reconnectUrl) {
          window.location.href = result.reconnectUrl;
          return;
        }
        toast.success("Mailbox reconnected");
        window.location.reload();
      };
      const deleteMailbox = async () => {
        let response = await fetch(`/api/mailboxes/${mailbox._id}`, { method: "DELETE" });
        if (
          response.status === 409 &&
          window.confirm("Mailbox has active links. Archive anyway?")
        ) {
          response = await fetch(`/api/mailboxes/${mailbox._id}?force=true`, { method: "DELETE" });
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Delete failed");
        toast.success("Mailbox archived");
        window.location.reload();
      };
      const changeRamp = async (
        action: "enable" | "disable" | "pause" | "resume" | "reset" | "update",
        targetLimit = mailbox.rampTargetLimit || 30
      ) => {
        const response = await fetch(`/api/mailboxes/${mailbox._id}/ramp`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, targetLimit }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Ramp update failed");
        toast.success(
          action === "enable"
            ? "Mailbox ramp enabled"
            : action === "disable"
              ? "Mailbox ramp disabled"
              : action === "pause"
                ? "Mailbox ramp paused"
                : action === "resume"
                  ? "Mailbox ramp resumed"
                  : action === "reset"
                    ? "Mailbox ramp reset"
                    : "Ramp target updated"
        );
        window.location.reload();
      };
      const setRampTarget = async () => {
        const value = window.prompt("Ramp target per day", String(mailbox.rampTargetLimit || 30));
        if (value === null) return;
        const target = Number(value);
        if (!Number.isInteger(target) || target < 5 || target > 100) {
          throw new Error("Ramp target must be between 5 and 100");
        }
        await changeRamp("update", target);
      };
      const evaluateRamp = async () => {
        const response = await fetch(`/api/mailboxes/${mailbox._id}/ramp/evaluate`, {
          method: "POST",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Ramp evaluation failed");
        toast.success(`Ramp ${result.decision.status}: ${result.decision.reason}`);
        window.location.reload();
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-sm p-0 text-base font-medium transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(mailbox._id)}>
              Copy Mailbox ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void checkMailbox().catch((error) => toast.error(error.message))}
            >
              <Activity className="mr-2 h-4 w-4" />
              Test connection
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void reconnectMailbox().catch((error) => toast.error(error.message))}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void evaluateRamp().catch((error) => toast.error(error.message))}
            >
              <Gauge className="mr-2 h-4 w-4" />
              Evaluate ramp
            </DropdownMenuItem>
            {mailbox.rampEnabled ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    void changeRamp(mailbox.rampStatus === "paused" ? "resume" : "pause").catch(
                      (error) => toast.error(error.message)
                    )
                  }
                >
                  {mailbox.rampStatus === "paused" ? (
                    <Play className="mr-2 h-4 w-4" />
                  ) : (
                    <Pause className="mr-2 h-4 w-4" />
                  )}
                  {mailbox.rampStatus === "paused" ? "Resume ramp" : "Pause ramp"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void setRampTarget().catch((error) => toast.error(error.message))}
                >
                  <Gauge className="mr-2 h-4 w-4" />
                  Set ramp target
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!window.confirm("Reset ramp progress to 5 sends per day?")) return;
                    void changeRamp("reset").catch((error) => toast.error(error.message));
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset ramp
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  void changeRamp("enable").catch((error) => toast.error(error.message))
                }
              >
                <Play className="mr-2 h-4 w-4" />
                Enable ramp
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-error focus:bg-error-muted focus:text-error"
              onClick={() => void deleteMailbox().catch((error) => toast.error(error.message))}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
