import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { JOB_CADENCE } from "../../src/server/jobs/cadence";
import type { MailboxPollPayload } from "../../src/server/jobs/types";

const { poll, pollBatchSize } = JOB_CADENCE.inngest;

// Inngest bills every step, so mailboxes are polled in batches rather than one event each.
export const pollMailboxes = inngest.createFunction(
  {
    id: "poll-mailboxes",
    // A slow tick finishes before the next starts, so no mailbox is polled twice at once.
    concurrency: [inngestConcurrency, { key: '"poll-mailboxes"', limit: 1 }],
    triggers: [{ cron: poll.cron }, { event: "mailbox/poll/all" }],
  },
  async ({ step }) => {
    const deps = createWorkerDeps();
    const mailboxes = await step.run("list-mailboxes", () => deps.listMailboxes());
    let polled = 0;
    let failed = 0;
    for (let start = 0; start < mailboxes.length; start += pollBatchSize) {
      const batch = mailboxes.slice(start, start + pollBatchSize);
      const result = await step.run(`poll-mailboxes-${start}`, () => deps.pollMailboxBatch(batch));
      polled += result.polled;
      failed += result.failed;
    }
    return { polled, failed };
  }
);

export const pollSingleMailbox = inngest.createFunction(
  {
    id: "poll-single-mailbox",
    triggers: [{ event: "mailbox/poll/single" }],
    concurrency: [inngestConcurrency, { key: "event.data.mailboxId", limit: 1 }],
  },
  async ({ event, step }) => {
    return await step.run("poll-single-mailbox", () =>
      createWorkerDeps().pollMailbox(event.data as MailboxPollPayload)
    );
  }
);
