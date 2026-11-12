import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { JOB_CADENCE } from "../../src/server/jobs/cadence";

export const purgeExpired = inngest.createFunction(
  {
    id: "purge-expired",
    concurrency: inngestConcurrency,
    triggers: [{ cron: JOB_CADENCE.inngest.purge.cron }],
  },
  async ({ step }) => {
    return await step.run("purge-expired-data", async () => createWorkerDeps().purgeExpired());
  }
);
