import { ActionFunctionArgs, json } from "@remix-run/node";
import { requireValidSignature } from "~/lib/utils.server";

// import { webhookQueue } from "~/lib/bullish.server";
import { WebhookCast } from "~/lib/types";
import { isRuleTargetApplicable } from "~/lib/automod.server";
import { db } from "~/lib/db.server";
import { getWarpcastChannel, isChannelMember, moderateCast } from "~/lib/warpcast.server";
import { validateCast } from "~/lib/cast-mod.server";
import { unknown } from "zod";
import { ModeratedChannel } from "@prisma/client";
import { Rule } from "~/rules/rules.type";

export async function action({ request }: ActionFunctionArgs) {
  const rawPayload = await request.text();
  const webhookNotif = JSON.parse(rawPayload) as {
    type: string;
    data: WebhookCast;
  };

  if (webhookNotif.type !== "cast.created") {
    return json({ message: "Invalid webhook type" }, { status: 400 });
  }

  await requireValidSignature({
    request,
    payload: rawPayload,
    sharedSecret: process.env.NEYNAR_WEBHOOK_SECRET!,
    incomingSignature: request.headers.get("X-Neynar-Signature")!,
  });

  const channelName = webhookNotif.data?.channel?.id;

  if (!channelName) {
    console.error(`Couldn't extract channel name: ${webhookNotif.data.root_parent_url}`, webhookNotif.data);
    return json({ message: "Invalid channel name" }, { status: 400 });
  }

  if (isRuleTargetApplicable("reply", webhookNotif.data)) {
    return json({ message: "Ignoring reply" });
  }
  const moderatedChannel = await db.moderatedChannel.findUnique({
    where: {
      id: channelName,
    },
  });
  if (!moderatedChannel) {
    return json({ message: "no moderated channel found" });
  }
  if (process.env.NODE_ENV === "development") {
    console.log(webhookNotif);
  }
  // check if channel member
  const authorFid = webhookNotif.data.author.fid;
  const isMember = await isChannelMember({ channel: channelName, fid: authorFid });
  if (!isMember) {
    return json({ message: "Ignoring cast from non-member" });
  }
  const wcChannel = await getWarpcastChannel({ channel: channelName });
  const channelModeratorFids = wcChannel.moderatorFids;
  const goodFids =
    channelModeratorFids.includes(authorFid) ||
    moderatedChannel.excludeUsernamesParsed.map((u) => u.value).includes(authorFid);

  let shouldHide = false;
  const rulesLength = moderatedChannel.castRuleSetParsed?.ruleParsed.conditions?.length || 0;
  const slowMode = moderatedChannel.slowModeHours > 0;
  if (!goodFids) {
    if (slowMode) {
      const count = await db.castLog.count({
        where: {
          channelId: channelName,
          authorFid,
          createdAt: {
            gte: Math.floor(new Date().getTime() / 1000) - 3600 * moderatedChannel.slowModeHours,
          },
        },
      });
      shouldHide = count >= 1;
    }
    if (!shouldHide && rulesLength > 0) {
      const result = await validateCast({
        moderatedChannel: moderatedChannel as unknown as ModeratedChannel & { castRuleSetParsed: { ruleParsed: Rule } },
        cast: webhookNotif.data,
      });
      shouldHide = !result.passedRule;
    }
  }

  await db.castLog.create({
    data: {
      hash: webhookNotif.data.hash,
      channelId: channelName,
      authorFid: webhookNotif.data.author.fid,
      data: JSON.stringify(webhookNotif.data),
      createdAt: Math.floor(new Date(webhookNotif.data.timestamp).getTime() / 1000),
      status: shouldHide ? 1 : 0,
    },
  });
  if (shouldHide && channelModeratorFids.includes(861203)) {
    console.log(`Hiding cast ${webhookNotif.data.hash} from ${channelName}`);
    await moderateCast({ hash: webhookNotif.data.hash, action: "hide" });
  }

  return json({
    message: "success",
  });
}
