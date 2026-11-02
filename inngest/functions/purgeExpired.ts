import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";

export const purgeExpired = inngest.createFunction(
  {
    id: "purge-expired",
    concurrency: inngestConcurrency,
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    return await step.run("purge-expired-data", async () => createWorkerDeps().purgeExpired());
  }
);
