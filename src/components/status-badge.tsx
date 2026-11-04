"use client";

import * as React from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const STATUSES: Record<string, { label: string; tone: StatusTone }> = {
  // Campaigns
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  running: { label: "Running", tone: "info" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  error: { label: "Error", tone: "error" },

  // Contacts and assignments
  pending: { label: "Pending", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  replied: { label: "Replied", tone: "success" },
  bounced: { label: "Bounced", tone: "error" },
  unsubscribed: { label: "Unsubscribed", tone: "neutral" },

  // Mailboxes (and active campaigns)
  active: { label: "Active", tone: "success" },
  disconnected: { label: "Disconnected", tone: "error" },
};

const DOT_VARIANT = {
  success: "success",
  info: "accent",
  neutral: "neutral",
} as const;

function readable(status: string) {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Astryx status rules: states that need action (warning, error) get a solid Badge with a
 * status icon; everything else is a StatusDot plus the word, so healthy rows stay quiet.
 */
export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  if (tone === "error" || tone === "warning") {
    return (
      <span className={cn("inline-flex", className)}>
        <Badge variant={tone} label={label} icon={<Icon icon={tone} size="xsm" />} />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2 text-base whitespace-nowrap", className)}>
      <StatusDot variant={DOT_VARIANT[tone]} label={label} />
      {label}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUSES[status.toLowerCase()] ?? {
    label: readable(status),
    tone: "neutral" as const,
  };
  return <StatusPill tone={config.tone} label={config.label} className={className} />;
}
