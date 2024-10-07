/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, Queue, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { SweepArgs } from "~/routes/~.channels.$id.tools";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const webhookQueue = new Queue("webhookQueue", {
  connection,
});

export const webhookWorker = new Worker(
  "webhookQueue",
  async (job: Job<{ url: string }>) => {
    // wait 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    console.log("webhook", job.data.url);
  },
  {
    connection,
    lockDuration: 30_000,
    concurrency: 25,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

webhookWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

// sweeeeep
export const sweepQueue = new Queue("sweepQueue", {
  connection,
});

export const sweepWorker = new Worker(
  "sweepQueue",
  async (job: Job<SweepArgs>) => {
    console.log("sweeping", job.data);
  },
  {
    connection,
    concurrency: 25,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

sweepWorker.on("error", Sentry.captureException);
sweepWorker.on("active", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channelId}] sweeping...`);
  }
});
sweepWorker.on("failed", (job, err) => {
  console.error(`[${job?.data.channelId}] failed`, err);
});

sweepWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] sweep completed`);
});
