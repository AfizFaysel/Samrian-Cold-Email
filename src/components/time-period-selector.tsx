"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TimePeriod = "7" | "30" | "90";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const periodLabels: Record<TimePeriod, { short: string; long: string }> = {
  "7": { short: "7d", long: "Last 7 days" },
  "30": { short: "30d", long: "Last 30 days" },
  "90": { short: "90d", long: "Last 90 days" },
};

/** Segmented control for the reporting window. */
export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Time period"
      className="inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {(Object.keys(periodLabels) as TimePeriod[]).map((period) => {
        const checked = value === period;
        return (
          <button
            key={period}
            type="button"
            role="radio"
            aria-checked={checked}
            title={periodLabels[period].long}
            onClick={() => onChange(period)}
            className={cn(
              "h-7 rounded-sm px-2.5 text-sm font-medium text-secondary transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-accent",
              checked && "bg-card text-primary shadow-sm"
            )}
          >
            <span className="sr-only">{periodLabels[period].long}</span>
            <span aria-hidden>{periodLabels[period].short}</span>
          </button>
        );
      })}
    </div>
  );
}

export function getPeriodLabel(days: number): string {
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  return "period";
}
