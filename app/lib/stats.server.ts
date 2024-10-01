/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./db.server";
import { getSetCache } from "./utils.server";

export type ModerationStats30Days = {
  likes: number;
  hides: number;
  approvalRate: number;
  uniqueCasters: number;
};

export async function getModerationStats30Days({ channelId }: { channelId: string }) {
  const cacheKey = `moderationStats30Days:${channelId}`;
  const logs = await db.moderationLog.findMany({
    where: {
      channelId: channelId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      affectedUserFid: true,
      action: true,
    },
  });

  const totalCount = new Set(logs.map((log) => log.affectedUserFid)).size;
  const likeCount = new Set(logs.filter((log) => log.action === "like").map((log) => log.affectedUserFid)).size;

  return {
    likes: likeCount,
    hides: totalCount - likeCount,
    approvalRate: totalCount === 0 ? 0 : likeCount / totalCount,
    uniqueCasters: likeCount,
  };
}
