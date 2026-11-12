import { createWorkerDeps } from "../../src/server/worker";
import { JOB_CADENCE } from "../../src/server/jobs/cadence";
import { inngest, inngestConcurrency } from "../client";

export const evaluateMailboxRamps = inngest.createFunction(
  {
    id: "evaluate-mailbox-ramps",
    concurrency: inngestConcurrency,
    triggers: [{ cron: JOB_CADENCE.inngest.ramp.cron }, { event: "mailbox/ramp" }],
  },
  async ({ step }) =>
    step.run("evaluate-mailbox-ramps", () => createWorkerDeps().evaluateMailboxRamps())
);
