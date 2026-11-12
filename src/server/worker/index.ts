export { createWorkerDeps } from "./deps";
export {
  createBullMqWorkerProcessors,
  createBullMqWorkers,
  type BullMqWorkerRuntime,
  type WorkerDeps,
  type WorkerProcessorMap,
} from "./worker";

import { JOB_CADENCE } from "../jobs/cadence";
import { readQueueConfig } from "../queue";
import type { JobQueue } from "../ports";
import { createWorkerDeps } from "./deps";
import { createBullMqWorkers } from "./worker";

export function startWorker(queue?: JobQueue) {
  const config = readQueueConfig();
  if (config.provider !== "bullmq") {
    throw new Error("Worker process requires JOB_PROVIDER=bullmq");
  }

  return createBullMqWorkers(config, createWorkerDeps(queue));
}

// In-flight jobs still enqueue and consume limits, so everything they use closes after the drain.
export function createWorkerShutdown(input: {
  worker: { close(): Promise<void> };
  queue: { close(): Promise<void> };
  closeLimits: () => Promise<void>;
}) {
  let stopping: Promise<void> | undefined;
  const stop = async () => {
    await input.worker.close();
    await Promise.all([input.queue.close(), input.closeLimits()]);
  };
  return () => (stopping ??= stop());
}

export async function scheduleWorkerJobs(queue: JobQueue) {
  const cadence = JOB_CADENCE.bullmq;
  const at = (job: { cron: string }) => ({ cron: job.cron, timezone: "UTC" });
  await Promise.all([
    queue.scheduleCampaignDispatch(at(cadence.dispatch)),
    queue.scheduleMailboxPolls(at(cadence.poll)),
    queue.scheduleMailboxChecks(at(cadence.check)),
    queue.scheduleMailboxRamp(at(cadence.ramp)),
    queue.scheduleDailyCounterReset(at(cadence.reset)),
    queue.scheduleRetentionPurge(at(cadence.purge)),
  ]);
}
