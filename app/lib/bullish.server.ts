/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, JobsOptions, Queue, UnrecoverableError, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { SimulateArgs, SweepArgs } from "~/routes/~.channels.$id.tools";
import { db } from "./db.server";
import { neynar, pageChannelCasts } from "./neynar.server";
import { ValidateCastArgsV2 } from "./types";
import { toggleWebhook } from "~/routes/api.channels.$id.toggleEnable";
import { getCast, getWarpcastChannel, publishCast } from "./warpcast.server";
import { modbotFid } from "~/routes/~.channels.$id";
import { syncSubscriptions } from "./subscription.server";
import { sendNotification } from "./notifications.server";
import axios from "axios";
import { userPlans } from "./utils";
import { getUsage, validateCast, ValidateCastArgs } from "./automod.server";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const subscriptionQueue = new Queue("subscriptionQueue", {
  connection,
});

export const propagationDelayQueue = new Queue("propagationDelayQueue", {
  connection,
});

export const propagationDelayWorker = new Worker(
  "propagationDelayQueue",
  async () => {
    console.log("Checking propagation delay");

    // const uuid = process.env.AUTOMOD_FACTORY_UUID!;
    // const username = "automod-factory";
    // const delayThreshold = 15 * 60 * 1000;

    // const checks = await db.propagationDelayCheck.findMany({
    //   where: {
    //     arrivedAt: null,
    //     createdAt: {
    //       gte: new Date(Date.now() - 24 * 60 * 60 * 1_000),
    //     },
    //   },
    // });

    // if (!checks.length) {
    //   const neynarToWarpcast = await neynar.publishCast(
    //     uuid,
    //     `neynar -> warpcast\n${new Date().toISOString()}`
    //   );
    //   const warpcastToNeynar = await publishCast({
    //     text: `warpcast -> neynar\n${new Date().toISOString()}`,
    //     token: process.env.AUTOMOD_FACTORY_WARPCAST_TOKEN!,
    //   });

    //   await db.propagationDelayCheck.create({
    //     data: {
    //       hash: neynarToWarpcast.hash,
    //       arrivedAt: null,
    //       src: "neynar",
    //       dst: "warpcast",
    //     },
    //   });

    //   await db.propagationDelayCheck.create({
    //     data: {
    //       hash: warpcastToNeynar.result.cast.hash,
    //       arrivedAt: null,
    //       src: "warpcast",
    //       dst: "neynar",
    //     },
    //   });

    //   return;
    // }

    // for (const check of checks) {
    //   const delay = new Date().getTime() - new Date(check.createdAt).getTime();
    //   const delaySeconds = Math.floor(delay / 1_000);

    //   if (delay > delayThreshold) {
    //     await axios.post("https://webhook-relay.fly.dev/automod", {
    //       text: `Warning: Cast propagation delay from ${check.src} to ${
    //         check.dst
    //       } exceeded ${delaySeconds.toLocaleString()} seconds.\nhttps://explorer.neynar.com/${check.hash}`,
    //     });
    //   }

    //   if (check.dst === "neynar") {
    //     const rsp = await neynar.fetchBulkCasts([check.hash]);
    //     if (rsp.result.casts.length !== 0) {
    //       const cast = rsp.result.casts[0];
    //       await db.propagationDelayCheck.update({
    //         where: {
    //           id: check.id,
    //         },
    //         data: {
    //           arrivedAt: cast.timestamp,
    //         },
    //       });
    //     }
    //   } else if (check.dst === "warpcast") {
    //     const cast = await getCast({ hash: check.hash, username });
    //     if (cast) {
    //       const delaySeconds = Math.floor(
    //         (new Date(cast.timestamp).getTime() - check.createdAt.getTime()) / 1_000
    //       );
    //       console.log(
    //         `[propagation-delay] ${check.hash} arrived after ${delaySeconds.toLocaleString()} seconds`
    //       );
    //       await db.propagationDelayCheck.update({
    //         where: {
    //           id: check.id,
    //         },
    //         data: {
    //           arrivedAt: new Date(cast.timestamp),
    //         },
    //       });
    //     }
    //   }
    // }
  },
  {
    connection,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

export const subscriptionWorker = new Worker(
  "subscriptionQueue",
  async () => {
    console.log("Checking subscription status for all active users");
    // await syncSubscriptions();
  },
  {
    connection,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

subscriptionWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
  console.error(`Subscription worker error`, err);
});

subscriptionWorker.on("failed", (job, err) => {
  console.error("Subscription worker failed", err);
});

export const webhookQueue = new Queue("webhookQueue", {
  connection,
});

export const webhookWorker = new Worker("webhookQueue", async (job: Job<ValidateCastArgsV2>) => {}, {
  connection,
  lockDuration: 30_000,
  concurrency: 25,
  autorun: !!process.env.ENABLE_QUEUES,
});

webhookWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

export const castQueue = new Queue("castQueue", {
  connection,
  // temporarily lifo
  defaultJobOptions: {
    lifo: true,
  },
});

export const castWorker = new Worker(
  "castQueue",
  async (job: Job<ValidateCastArgs>) => {
    // await validateCast(job.data);
  },
  {
    connection,
    lockDuration: 30_000,
    concurrency: 10,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);
castWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

castWorker.on("active", async (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.moderatedChannel.id}]: ${job.id} is now active`);
  }

  // await db.castLog.upsert({
  //   where: {
  //     hash: job.data.cast.hash,
  //   },
  //   create: {
  //     hash: job.data.cast.hash,
  //     replyCount: job.data.cast.replies.count,
  //     channelId: job.data.moderatedChannel.id,
  //     status: "active",
  //   },
  //   update: {
  //     status: "active",
  //   },
  // });
});

castWorker.on("completed", async (job) => {
  // if (process.env.NODE_ENV === "development") {
  //   console.log(`${job.data.moderatedChannel.id}: cast ${job.data.cast.hash} completed`);
  // }
  // await db.castLog.upsert({
  //   where: {
  //     hash: job.data.cast.hash,
  //   },
  //   create: {
  //     hash: job.data.cast.hash,
  //     replyCount: job.data.cast.replies.count,
  //     channelId: job.data.moderatedChannel.id,
  //     status: "completed",
  //   },
  //   update: {
  //     status: "completed",
  //   },
  // });
});

castWorker.on("failed", async (job, err: any) => {
  // const message = err?.response?.data || err?.message || "unknown error";
  // if (job) {
  //   console.error(`[${job.data.moderatedChannel?.id}]: cast ${job.data.cast?.hash} failed`, message);
  //   await db.castLog.upsert({
  //     where: {
  //       hash: job.data.cast.hash,
  //     },
  //     create: {
  //       hash: job.data.cast.hash,
  //       replyCount: job.data.cast.replies.count,
  //       channelId: job.data.moderatedChannel.id,
  //       status: "failed",
  //     },
  //     update: {
  //       status: "failed",
  //     },
  //   });
  // } else {
  //   console.error("job failed", message);
  // }
});

export const recoverQueue = new Queue("recoverQueue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 300,
    removeOnFail: 300,
    attempts: 3,
  },
});

export const recoverWorker = new Worker(
  "recoverQueue",
  async (job: Job<SweepArgs>) => {
    // try {
    //   await recover({
    //     channelId: job.data.channelId,
    //     limit: job.data.limit,
    //     untilTimeUtc: job.data.untilTimeUtc,
    //     untilCastHash: job.data.untilCastHash,
    //     moderatedChannel: job.data.moderatedChannel,
    //     skipSignerCheck: job.data.skipSignerCheck,
    //   });
    // } catch (e) {
    //   Sentry.captureException(e);
    //   throw e;
    // }
  },
  {
    connection,
    concurrency: 25,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

// sweeeeep
export const sweepQueue = new Queue("sweepQueue", {
  connection,
});

export const sweepWorker = new Worker(
  "sweepQueue",
  async (job: Job<SweepArgs>) => {
    // try {
    //   await sweep({
    //     channelId: job.data.channelId,
    //     limit: job.data.limit,
    //     untilTimeUtc: job.data.untilTimeUtc,
    //     untilCastHash: job.data.untilCastHash,
    //     moderatedChannel: job.data.moderatedChannel,
    //   });
    // } catch (e) {
    //   Sentry.captureException(e);
    //   throw e;
    // }
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

// sweeeeep
export const simulationQueue = new Queue("simulationQueue", {
  connection,
});

export const simulationWorker = new Worker(
  "simulationQueue",
  async (job: Job<SimulateArgs>) => {
    // let result;
    // try {
    //   result = await simulate({
    //     channelId: job.data.channelId,
    //     limit: job.data.limit,
    //     moderatedChannel: job.data.moderatedChannel,
    //     proposedModeratedChannel: job.data.proposedModeratedChannel,
    //     onProgress: async (castsProcessed: number) => {
    //       await job.updateProgress(castsProcessed);
    //     },
    //   });
    // } catch (e) {
    //   Sentry.captureException(e);
    //   throw e;
    // }
    // return result;
  },
  {
    connection,
    autorun: !!process.env.ENABLE_QUEUES,
  }
);

simulationWorker.on("error", Sentry.captureException);
simulationWorker.on("active", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channelId}] simulating...`);
  }
});

simulationWorker.on("failed", (job, err) => {
  console.error(`[${job?.data.channelId}] failed`, err);
});

simulationWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] simulation completed`);
});

// sync queue
export const syncQueue = new Queue("syncQueue", {
  connection,
});

export const syncWorker = new Worker(
  "syncQueue",
  async (job: Job<{ channelId: string; rootCastsToProcess: number }>) => {
    // const moderatedChannel = await db.moderatedChannel.findFirst({
    //   where: {
    //     id: job.data.channelId,
    //     active: true,
    //   },
    // });
    // if (!moderatedChannel) {
    //   console.error(`[${job.data.channelId}] sync: moderated channel not found`);
    //   return;
    // }
    // let rootCastsChecked = 0;
    // for await (const page of pageChannelCasts({ id: job.data.channelId })) {
    //   if (process.env.NODE_ENV === "development") {
    //     console.log(`[${job.data.channelId}] sync: page length ${page.casts.length}`);
    //   }
    //   const castHashes = page.casts.map((cast) => cast.hash);
    //   const alreadyProcessed = await db.castLog.findMany({
    //     where: {
    //       hash: {
    //         in: castHashes,
    //       },
    //     },
    //   });
    //   for (const rootCast of page.casts) {
    //     if (process.env.NODE_ENV === "development") {
    //       console.log(`[${job.data.channelId}] sync: processing cast ${rootCast.hash}`);
    //     }
    //     if (rootCastsChecked >= job.data.rootCastsToProcess) {
    //       return;
    //     }
    //     if (alreadyProcessed.some((log) => log.hash === rootCast.hash)) {
    //       if (process.env.NODE_ENV === "development") {
    //         console.log(`[${job.data.channelId}] sync: cast ${rootCast.hash} already processed`);
    //       }
    //       continue;
    //     }
    //     castQueue.add(
    //       "processCast",
    //       {
    //         moderatedChannel,
    //         cast: rootCast,
    //       },
    //       defaultProcessCastJobArgs(rootCast.hash)
    //     );
    //     rootCastsChecked++;
    //   }
    // }
  },
  { connection, autorun: !!process.env.ENABLE_QUEUES }
);

syncWorker.on("error", (err) => {
  Sentry.captureException(err);
});

syncWorker.on("active", (job) => {
  console.log(`[${job.data.channelId}] sync: active`);
});

syncWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] sync: completed`);
});

export function defaultProcessCastJobArgs(hash: string): JobsOptions {
  return {
    jobId: `cast-${hash}`,
    removeOnComplete: 20000,
    removeOnFail: 5000,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    attempts: 4,
  };
}

function init() {
  if (process.env.NODE_ENV === "production") {
    subscriptionQueue.add("subscriptionSync", {}, { repeat: { pattern: "0 0 * * *" } });
    propagationDelayQueue.add("propagationDelayCheck", {}, { repeat: { pattern: "*/10 * * * *" } });
  }
}
