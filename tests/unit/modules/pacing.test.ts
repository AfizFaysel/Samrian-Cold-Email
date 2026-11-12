import { describe, expect, test } from "vitest";

import {
  HOUR_MS,
  HOURLY_SEND_LIMIT,
  planSendSlot,
  SEND_GAP_MAX_MS,
  SEND_GAP_MIN_MS,
  type PacingState,
} from "../../../src/server/modules/pacing";

const now = Date.parse("2026-07-06T14:00:00.000Z");
const horizonMs = 5 * 60 * 1000;
const fresh: PacingState = { hourSends: 0 };

describe("planSendSlot", () => {
  test("sends a fresh mailbox now and spaces the next send by a random gap", () => {
    expect(planSendSlot({ state: fresh, now, horizonMs, random: () => 0 })).toEqual({
      status: "ready",
      sendAt: now,
      next: { nextSendAt: now + SEND_GAP_MIN_MS, hourStartedAt: now, hourSends: 1 },
    });

    const slot = planSendSlot({ state: fresh, now, horizonMs, random: () => 0.999 });
    expect(slot.status === "ready" && slot.next.nextSendAt! - now).toBeLessThanOrEqual(
      SEND_GAP_MAX_MS
    );
  });

  test("waits for the mailbox's next slot when it falls inside this run", () => {
    const state = { nextSendAt: now + 120_000, hourStartedAt: now - 60_000, hourSends: 2 };

    expect(planSendSlot({ state, now, horizonMs, random: () => 0 })).toMatchObject({
      status: "ready",
      sendAt: now + 120_000,
      next: { nextSendAt: now + 120_000 + SEND_GAP_MIN_MS, hourSends: 3 },
    });
  });

  test("leaves the mailbox alone until a later slot", () => {
    const state = { nextSendAt: now + horizonMs + 1, hourSends: 0 };

    expect(planSendSlot({ state, now, horizonMs })).toEqual({
      status: "wait",
      until: now + horizonMs + 1,
    });
  });

  test("holds a full hour until the next one opens", () => {
    const hourStartedAt = now - 10 * 60 * 1000;
    const state = { nextSendAt: now, hourStartedAt, hourSends: HOURLY_SEND_LIMIT };

    expect(planSendSlot({ state, now, horizonMs })).toEqual({
      status: "wait",
      until: hourStartedAt + HOUR_MS,
    });
  });

  test("opens a new hour once the slot is an hour past the last one", () => {
    const hourStartedAt = now - HOUR_MS - 1;
    const state = { nextSendAt: now, hourStartedAt, hourSends: HOURLY_SEND_LIMIT };

    expect(planSendSlot({ state, now, horizonMs, random: () => 0 })).toMatchObject({
      status: "ready",
      sendAt: now,
      next: { hourStartedAt: now, hourSends: 1 },
    });
  });
});
