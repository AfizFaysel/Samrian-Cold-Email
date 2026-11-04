import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Info,
  PauseCircle,
  PlayCircle,
  Send,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

type StatusConfig = {
  label: string;
  tone: StatusTone;
  icon: React.ComponentType<{ className?: string }>;
};

// Every tone has its own glyph, so status still reads for colour-blind people.
const STATUSES: Record<string, StatusConfig> = {
  // Campaigns
  draft: { label: "Draft", tone: "neutral", icon: CircleDashed },
  scheduled: { label: "Scheduled", tone: "warning", icon: Clock },
  running: { label: "Running", tone: "info", icon: PlayCircle },
  paused: { label: "Paused", tone: "warning", icon: PauseCircle },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  error: { label: "Error", tone: "error", icon: AlertCircle },

  // Contacts and assignments
  pending: { label: "Pending", tone: "neutral", icon: CircleDashed },
  sent: { label: "Sent", tone: "info", icon: Send },
  replied: { label: "Replied", tone: "success", icon: CheckCircle2 },
  bounced: { label: "Bounced", tone: "error", icon: XCircle },
  unsubscribed: { label: "Unsubscribed", tone: "neutral", icon: AlertCircle },

  // Mailboxes (and active campaigns)
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", tone: "error", icon: AlertCircle },
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  error: "bg-error-muted text-error",
  info: "bg-accent-muted text-accent",
  neutral: "bg-muted text-secondary",
};

const TONE_ICONS: Record<StatusTone, StatusConfig["icon"]> = {
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  info: Info,
  neutral: CircleDashed,
};

function readable(status: string) {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A tone as a pill: icon plus a word. Colour never stands alone. */
export function StatusPill({
  tone,
  label,
  icon,
  showIcon = true,
  className,
}: {
  tone: StatusTone;
  label: string;
  icon?: StatusConfig["icon"];
  showIcon?: boolean;
  className?: string;
}) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {showIcon && <Icon className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = STATUSES[status.toLowerCase()] ?? {
    label: readable(status),
    tone: "neutral" as const,
    icon: CircleDashed,
  };

  return (
    <StatusPill
      tone={config.tone}
      label={config.label}
      icon={config.icon}
      showIcon={showIcon}
      className={className}
    />
  );
}
