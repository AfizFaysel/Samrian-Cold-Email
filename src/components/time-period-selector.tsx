"use client";

import * as React from "react";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";

export type TimePeriod = "7" | "30" | "90";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const PERIODS: TimePeriod[] = ["7", "30", "90"];

/** Segmented control for the reporting window. */
export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <SegmentedControl
      label="Time period"
      size="sm"
      value={value}
      onChange={(period) => onChange(period as TimePeriod)}
    >
      {PERIODS.map((period) => (
        <SegmentedControlItem key={period} value={period} label={`${period} days`} />
      ))}
    </SegmentedControl>
  );
}

export function getPeriodLabel(days: number): string {
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  return "period";
}
