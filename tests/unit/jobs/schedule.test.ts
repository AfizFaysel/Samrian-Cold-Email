import { describe, expect, test } from "vitest";

import { getStepDelayMs, isInSendWindow, nextWindowStart } from "../../../src/server/jobs/schedule";

const schedule = {
  timezone: "America/New_York",
  startTime: "09:00",
  endTime: "17:00",
  daysOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

describe("send schedule", () => {
  describe("invalid timezones", () => {
    const now = Date.parse("2026-07-06T14:00:00.000Z");
    const nairobi = { timezone: "Africa/Nairobi", startTime: "09:00", endTime: "12:00" };

    test("falls back from the contact to the campaign timezone", () => {
      const window = { schedule: nairobi, contactTimezone: "Mars/Olympus", now };

      expect(isInSendWindow(window)).toBe(false);
      expect(nextWindowStart(window)).toBe(nextWindowStart({ schedule: nairobi, now }));
    });

    test("falls back from the campaign timezone to its default", () => {
      expect(
        nextWindowStart({
          schedule: { ...nairobi, timezone: "Mars/Olympus", defaultTimezone: "Africa/Nairobi" },
          now,
        })
      ).toBe(nextWindowStart({ schedule: nairobi, now }));
    });

    test.each(["", "Mars/Olympus"])("uses UTC when nothing is valid (%j)", (contactTimezone) => {
      const schedule = { timezone: "Mars/Olympus", startTime: "13:00", endTime: "15:00" };

      expect(isInSendWindow({ schedule, contactTimezone, now })).toBe(true);
      expect(new Date(nextWindowStart({ schedule, contactTimezone, now })).toISOString()).toBe(
        "2026-07-07T13:00:00.000Z"
      );
    });
  });

  describe("the schedule the campaign wizard saves", () => {
    const wizard = {
      defaultTimezone: "America/New_York",
      daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      startTime: "09:00",
      endTime: "17:00",
    };

    test("does not send on an excluded day", () => {
      const saturdayNoonInNewYork = Date.parse("2026-11-07T17:00:00.000Z");

      expect(isInSendWindow({ schedule: wizard, now: saturdayNoonInNewYork })).toBe(false);
    });

    test("sends on an allowed day inside the window", () => {
      const mondayNoonInNewYork = Date.parse("2026-11-02T17:00:00.000Z");

      expect(isInSendWindow({ schedule: wizard, now: mondayNoonInNewYork })).toBe(true);
    });

    test("uses the campaign timezone's day, not UTC's", () => {
      const allDay = { ...wizard, startTime: "00:00", endTime: "23:59" };
      const sundayEveningInNewYork = Date.parse("2026-11-02T02:00:00.000Z");

      expect(isInSendWindow({ schedule: allDay, now: sundayEveningInNewYork })).toBe(false);
    });

    test("defers to the next allowed day", () => {
      const fridayEvening = Date.parse("2026-11-06T23:00:00.000Z");

      expect(
        new Date(nextWindowStart({ schedule: wizard, now: fridayEvening })).toISOString()
      ).toBe("2026-11-09T14:00:00.000Z");
    });
  });

  test("detects inside and outside send window", () => {
    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-06T14:00:00.000Z"),
      })
    ).toBe(true);

    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-06T22:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("enforces allowed send days", () => {
    expect(
      isInSendWindow({
        schedule,
        now: Date.parse("2026-07-04T14:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("contact timezone overrides campaign timezone", () => {
    expect(
      isInSendWindow({
        schedule,
        contactTimezone: "America/Los_Angeles",
        now: Date.parse("2026-07-06T14:00:00.000Z"),
      })
    ).toBe(false);
  });

  test("finds next window start across day boundary", () => {
    expect(
      nextWindowStart({
        schedule,
        now: Date.parse("2026-07-03T22:00:00.000Z"),
      })
    ).toBe(Date.parse("2026-07-06T13:00:00.000Z"));
  });

  test("uses first step immediate and follow-up default delay", () => {
    expect(getStepDelayMs([{ subject: "A" }], 0)).toBe(0);
    expect(getStepDelayMs([{ subject: "A" }, { subject: "B" }], 1)).toBe(3 * 24 * 60 * 60 * 1000);
  });

  test("explicit step delay overrides default", () => {
    expect(
      getStepDelayMs([{ subject: "A" }, { subject: "B", delayDays: 1, delayHours: 6 }], 1)
    ).toBe(30 * 60 * 60 * 1000);
  });
});
