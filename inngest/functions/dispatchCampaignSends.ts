import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { createInngestQueue } from "../lib/jobs";
import { JOB_CADENCE } from "../../src/server/jobs/cadence";

export const dispatchCampaignSends = inngest.createFunction(
  {
    id: "dispatch-campaign-sends",
    concurrency: inngestConcurrency,
    triggers: [{ cron: JOB_CADENCE.inngest.dispatch.cron }],
  },
  async ({ step }) => {
    return await createWorkerDeps(createInngestQueue(step)).dispatchDueSends();
  }
);
