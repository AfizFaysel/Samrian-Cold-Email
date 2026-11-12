// Spacing a mailbox's sends so it reads as a person, not a burst from a machine.
export const SEND_GAP_MIN_MS = 90_000;
export const SEND_GAP_MAX_MS = 420_000;
export const HOURLY_SEND_LIMIT = 8;
export const HOUR_MS = 60 * 60 * 1000;

export type PacingState = {
  nextSendAt?: number;
  hourStartedAt?: number;
  hourSends: number;
};

export type SendSlot =
  { status: "ready"; sendAt: number; next: PacingState } | { status: "wait"; until: number };

/**
 * The mailbox's next send time, if it falls before `now + horizonMs`.
 * A booked slot counts toward its hour even if the send is later cancelled: pacing may only
 * slow a mailbox down, never let it catch up in a burst.
 */
export function planSendSlot(input: {
  state: PacingState;
  now: number;
  horizonMs: number;
  hourlyLimit?: number;
  random?: () => number;
}): SendSlot {
  const { state, now } = input;
  const hourlyLimit = input.hourlyLimit ?? HOURLY_SEND_LIMIT;
  let sendAt = Math.max(now, state.nextSendAt ?? now);
  let hourStartedAt = state.hourStartedAt;
  let hourSends = state.hourSends;

  if (hourStartedAt !== undefined && hourSends >= hourlyLimit && sendAt < hourStartedAt + HOUR_MS) {
    sendAt = hourStartedAt + HOUR_MS;
  }
  if (sendAt > now + input.horizonMs) return { status: "wait", until: sendAt };

  if (hourStartedAt === undefined || sendAt >= hourStartedAt + HOUR_MS) {
    hourStartedAt = sendAt;
    hourSends = 0;
  }

  const random = input.random ?? Math.random;
  const gap = Math.round(SEND_GAP_MIN_MS + (SEND_GAP_MAX_MS - SEND_GAP_MIN_MS) * random());
  return {
    status: "ready",
    sendAt,
    next: { nextSendAt: sendAt + gap, hourStartedAt, hourSends: hourSends + 1 },
  };
}
