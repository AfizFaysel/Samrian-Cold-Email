import * as React from "react";
import type { CampaignDraft } from "../page";
import { Clock, Calendar } from "lucide-react";

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
  const toggleDay = (day: string) => {
    setDraft((prev) => {
      const daysAllowed = prev.schedule.daysAllowed.includes(day)
        ? prev.schedule.daysAllowed.filter((d) => d !== day)
        : [...prev.schedule.daysAllowed, day];

      return {
        ...prev,
        schedule: { ...prev.schedule, daysAllowed },
      };
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-primary">Schedule Configuration</h2>
        <p className="mt-2 text-base text-secondary">
          Define when emails should be sent to respect your contacts' time zones and working hours.
        </p>
      </div>

      <div className="space-y-8">
        {/* Default Timezone */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-base font-medium text-primary">
            <Clock className="h-4 w-4" />
            Default Timezone <span className="text-error">*</span>
          </label>
          <select
            value={draft.schedule.defaultTimezone}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                schedule: { ...prev.schedule, defaultTimezone: e.target.value },
              }))
            }
            className="w-full rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-secondary">
            Used for contacts without a specific timezone set
          </p>
        </div>

        {/* Days Allowed */}
        <div>
          <label className="mb-3 flex items-center gap-2 text-base font-medium text-primary">
            <Calendar className="h-4 w-4" />
            Allowed Days <span className="text-error">*</span>
          </label>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => {
              const isSelected = draft.schedule.daysAllowed.includes(day.value);
              return (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-md border-2 py-3 text-base font-medium transition-all ${
                    isSelected
                      ? "border-accent bg-accent-bg text-on-accent"
                      : "border-border bg-card text-secondary hover:border-accent/30"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-secondary">Emails will only be sent on selected days</p>
        </div>

        {/* Send Window */}
        <div>
          <label className="mb-3 text-base font-medium text-primary">
            Send Window <span className="text-error">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">Start Time</label>
              <input
                type="time"
                value={draft.schedule.startTime}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, startTime: e.target.value },
                  }))
                }
                className="w-full rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">End Time</label>
              <input
                type="time"
                value={draft.schedule.endTime}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, endTime: e.target.value },
                  }))
                }
                className="w-full rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-secondary">
            Emails will only be sent during this time window (in contact's timezone)
          </p>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-success/15 bg-success-muted/30 p-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-muted">
              <svg
                className="h-5 w-5 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="mb-1 text-base font-medium text-success">Best Practice</h3>
              <p className="text-base leading-relaxed text-success/70">
                For B2B outreach, we recommend Monday-Friday, 9 AM - 5 PM in the contact's local
                timezone. This maximizes open rates and response rates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
