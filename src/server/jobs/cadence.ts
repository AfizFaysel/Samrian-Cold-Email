// How often each scheduled job runs, per job runtime.
//
// bullmq is an always-on worker (a VPS, Railway): a tick costs CPU, not money, so it runs often.
// inngest is managed and bills every run and every step, so it ticks less and polls in batches.
// Its free plan allows about 50,000 executions a month.

export type ScheduledJob = { cron: string; intervalMs: number };

export type JobCadence = {
  // A dispatch run books sends up to one interval ahead, so the next run picks up after it.
  dispatch: ScheduledJob;
  poll: ScheduledJob;
  // Mailboxes polled per step on a managed runtime; one step must finish within a request.
  pollBatchSize: number;
  check: ScheduledJob;
  // Counters reset at each mailbox's local midnight, at most one interval late.
  reset: ScheduledJob;
  ramp: ScheduledJob;
  purge: ScheduledJob;
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function everyMinutes(minutes: 1 | 5 | 10 | 15 | 30): ScheduledJob {
  return {
    cron: minutes === 1 ? "* * * * *" : `*/${minutes} * * * *`,
    intervalMs: minutes * MINUTE,
  };
}

function hourly(): ScheduledJob {
  return { cron: "0 * * * *", intervalMs: 60 * MINUTE };
}

function dailyAt(hour: number, minute = 0): ScheduledJob {
  return { cron: `${minute} ${hour} * * *`, intervalMs: DAY };
}

export const JOB_CADENCE = {
  bullmq: {
    dispatch: everyMinutes(1),
    poll: everyMinutes(1),
    pollBatchSize: 1,
    check: hourly(),
    reset: everyMinutes(15),
    ramp: dailyAt(0, 15),
    purge: dailyAt(2),
  },
  inngest: {
    dispatch: everyMinutes(15),
    poll: everyMinutes(10),
    pollBatchSize: 5,
    check: dailyAt(6),
    reset: hourly(),
    ramp: dailyAt(0, 15),
    purge: dailyAt(2),
  },
} satisfies Record<"bullmq" | "inngest", JobCadence>;
