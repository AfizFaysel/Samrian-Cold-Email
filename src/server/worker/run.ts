import { createJobQueue } from "../queue";
import { createWorkerShutdown, scheduleWorkerJobs, startWorker } from ".";
import { closeLimitGuard } from "../limits";

const queue = createJobQueue();
await scheduleWorkerJobs(queue);
const worker = startWorker(queue);
const stop = createWorkerShutdown({ worker, queue, closeLimits: closeLimitGuard });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await stop();
    process.exit(0);
  });
}

console.log("[OK] BullMQ worker started");
