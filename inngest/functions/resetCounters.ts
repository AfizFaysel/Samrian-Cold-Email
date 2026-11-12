import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { JOB_CADENCE } from "../../src/server/jobs/cadence";

/**
 * Reset daily sending counters for each mailbox once its local day starts.
 *
 * Delegates counter updates to the provider-neutral reset handler.
 * which is a system-level operation with no user/org context.
 */
export const resetCounters = inngest.createFunction(
  {
    id: "reset-counters",
    concurrency: inngestConcurrency,
    triggers: [{ cron: JOB_CADENCE.inngest.reset.cron }],
  },
  async ({ step }) => {
    return await step.run("reset-mailbox-counters", async () => createWorkerDeps().resetCounters());
  }
);
