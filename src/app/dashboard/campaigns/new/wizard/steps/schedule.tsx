import * as React from "react";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { ToggleButton, ToggleButtonGroup } from "@astryxdesign/core/ToggleButton";
import { createISOTimeString } from "@astryxdesign/core/utils";
import type { CampaignDraft } from "../page";
import { StepIntro } from "./step-intro";

interface ScheduleStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

export function ScheduleStep({ draft, setDraft }: ScheduleStepProps) {
  const setSchedule = (patch: Partial<CampaignDraft["schedule"]>) =>
    setDraft((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StepIntro
        title="When to send"
        description="Emails go out on these days, inside this window, in each contact's time zone."
      />

      <Selector
        label="Default time zone"
        description="For contacts without a time zone of their own."
        width="100%"
        value={draft.schedule.defaultTimezone}
        onChange={(defaultTimezone) => setSchedule({ defaultTimezone })}
        options={TIMEZONES}
      />

      <div className="flex flex-col gap-2">
        <span className="text-base font-medium">Days</span>
        <ToggleButtonGroup
          label="Days"
          type="multiple"
          value={draft.schedule.daysAllowed}
          onChange={(value) => setSchedule({ daysAllowed: (value as string[]) ?? [] })}
        >
          {DAYS.map((day) => (
            <ToggleButton key={day.value} value={day.value} label={day.label} />
          ))}
        </ToggleButtonGroup>
        <Text type="supporting">Weekdays work best for B2B outreach.</Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TimeInput
          label="Start"
          width="100%"
          value={createISOTimeString(draft.schedule.startTime) ?? undefined}
          onChange={(startTime) => startTime && setSchedule({ startTime })}
        />
        <TimeInput
          label="End"
          width="100%"
          value={createISOTimeString(draft.schedule.endTime) ?? undefined}
          onChange={(endTime) => endTime && setSchedule({ endTime })}
        />
      </div>
    </div>
  );
}
