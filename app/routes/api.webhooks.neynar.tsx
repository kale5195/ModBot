import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import * as Sentry from "@sentry/remix";
import { ModeratedChannel, Prisma } from "@prisma/client";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { getChannel, neynar } from "~/lib/neynar.server";
import { requireValidSignature } from "~/lib/utils.server";
import {
  Action,
  Rule,
  actionFunctions,
  ruleFunctions,
} from "~/lib/validations.server";
import { getChannelHosts, hideQuietly, isCohost } from "~/lib/warpcast.server";

export const userPlans = {
  basic: {
    maxChannels: 1,
    maxRules: 1,
  },
  pro: {
    maxChannels: 4,
    maxRules: 4,
  },
  elite: {
    maxChannels: 10,
    maxRules: 10,
  },
};

const FullModeratedChannel =
  Prisma.validator<Prisma.ModeratedChannelDefaultArgs>()({
    include: {
      user: true,
      ruleSets: {
        where: {
          active: true,
        },
      },
    },
  });

export type FullModeratedChannel = Prisma.ModeratedChannelGetPayload<
  typeof FullModeratedChannel
>;

export async function action({ request }: ActionFunctionArgs) {
  const rawPayload = await request.text();
  const webhookNotif = JSON.parse(rawPayload) as {
    type: string;
    data: Cast & { root_parent_url: string };
  };

  if (process.env.NODE_ENV === "development") {
    console.log(webhookNotif);
  }

  if (webhookNotif.type !== "cast.created") {
    return json({ message: "Invalid webhook type" }, { status: 400 });
  }

  await requireValidSignature({
    request,
    payload: rawPayload,
    sharedSecret: process.env.NEYNAR_WEBHOOK_SECRET!,
    incomingSignature: request.headers.get("X-Neynar-Signature")!,
  });

  const channelName = webhookNotif.data.root_parent_url?.split("/").pop();

  if (!channelName) {
    console.error(
      `Couldn't extract channel name: ${webhookNotif.data.root_parent_url}`
    );
    return json({ message: "Invalid parent_url" }, { status: 400 });
  }

  const moderatedChannel = await db.moderatedChannel.findFirst({
    where: {
      OR: [{ id: channelName }, { url: webhookNotif.data.root_parent_url }],
      active: true,
    },
    include: {
      user: true,
      ruleSets: {
        where: {
          active: true,
        },
      },
    },
  });

  if (!moderatedChannel) {
    console.error(`Channel ${channelName} is not moderated`);
    return json({ message: "Channel is not moderated" }, { status: 404 });
  }

  if (moderatedChannel.user.plan === "expired") {
    console.error(
      `User's plan ${moderatedChannel.user.id} is expired, ${moderatedChannel.id} moderation disabled`
    );
    return json(
      { message: "User's plan is expired, moderation disabled" },
      { status: 403 }
    );
  }

  if (moderatedChannel.ruleSets.length === 0) {
    console.log(`Channel ${moderatedChannel.id} has no rules. Doing nothing.`);
    return json({ message: "Channel has no rules" }, { status: 200 });
  }

  const alreadyProcessed = await db.moderationLog.findFirst({
    where: {
      castHash: webhookNotif.data.hash,
    },
  });

  if (alreadyProcessed) {
    console.log(
      `Cast ${webhookNotif.data.hash.substring(0, 10)} already processed`
    );
    return json({ message: "Already processed" });
  }

  const cohost = await isCohost({
    fid: +moderatedChannel.userId,
    channel: moderatedChannel.id,
  });

  if (!cohost) {
    console.log(
      `User ${moderatedChannel.userId} is no longer a cohost. Disabling moderation.`
    );
    await db.moderatedChannel.update({
      where: {
        id: moderatedChannel.id,
      },
      data: {
        active: false,
      },
    });

    return json(
      { message: "Creator of moderated channel is no longer a cohost" },
      { status: 403 }
    );
  }

  const channel = await getChannel({ name: moderatedChannel.id }).catch(
    () => null
  );
  if (!channel) {
    console.error(
      `There's a moderated channel configured for ${moderatedChannel.id}, warpcast knows about it, but neynar doesn't. Something is wrong.`
    );
    return json({ message: "Channel not found" }, { status: 404 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("data", JSON.stringify(webhookNotif.data, null, 2));
  } else {
    console.log(channel.id, webhookNotif.data.hash);
  }

  await validateCast({
    channel,
    moderatedChannel,
    cast: webhookNotif.data,
  });

  return json({});
}

export async function validateCast({
  channel,
  moderatedChannel,
  cast,
}: {
  channel: Channel;
  moderatedChannel: FullModeratedChannel;
  cast: Cast;
}) {
  const isExcluded = JSON.parse(moderatedChannel.excludeUsernames).includes(
    cast.author.username
  );

  if (isExcluded) {
    console.log(`User @${cast.author.username} is excluded. Doing nothing.`);
    return;
  }

  if (moderatedChannel.excludeCohosts) {
    const cohosts = await getChannelHosts({ channel: channel.id });
    if (cohosts.result.hosts.find((c) => c.fid === cast.author.fid)) {
      console.log(`User @${cast.author.username} is a cohost. Doing nothing.`);
      return;
    }
  }

  const cooldown = await db.cooldown.findFirst({
    where: {
      affectedUserId: String(cast.author.fid),
      channelId: moderatedChannel.id,
      active: true,
      OR: [
        {
          expiresAt: {
            gte: new Date(),
          },
        },
        {
          // if null then its a soft-ban
          expiresAt: null,
        },
      ],
    },
  });

  if (cooldown) {
    await hideQuietly({
      channel: moderatedChannel.id,
      cast,
      action: { type: "hideQuietly" },
    });

    if (cooldown.expiresAt) {
      await logModerationAction(
        moderatedChannel.id,
        "hideQuietly",
        `User is in cooldown until ${cooldown.expiresAt.toISOString()}`,
        cast
      );
    } else {
      await logModerationAction(
        moderatedChannel.id,
        "hideQuietly",
        `User is currently muted`,
        cast
      );
    }

    return;
  }

  for (const ruleSet of moderatedChannel.ruleSets) {
    if (!isRuleTargetApplicable(ruleSet.target, cast)) {
      continue;
    }

    const rule: Rule = JSON.parse(ruleSet.rule);
    const actions: Action[] = JSON.parse(ruleSet.actions);

    const ruleEvaluation = await evaluateRules(moderatedChannel, cast, rule);

    if (ruleEvaluation.didViolateRule) {
      /**
       * Temporarily disabling ban threshold until I can
       * think more about it
       */
      // if (moderatedChannel.banThreshold) {
      //   const violations = await db.moderationLog.groupBy({
      //     by: ["channelId", "castHash"],
      //     where: {
      //       affectedUserFid: String(cast.author.fid),
      //     },
      //     _count: {
      //       _all: true,
      //     },
      //   });

      //   // note: use >= because this cast that has
      //   // violated the rules is not in the db at this
      //   // point.
      //   if (violations.length >= moderatedChannel.banThreshold) {
      //     const isCo = await isCohost({
      //       fid: cast.author.fid,
      //       channel: channel.id,
      //     });

      //     if (!isCo) {
      //       await ban({
      //         channel: channel.id,
      //         cast,
      //         action: { type: "ban" },
      //       });

      //       await logModerationAction(
      //         moderatedChannel.id,
      //         "ban",
      //         `User exceeded warn threshold of ${moderatedChannel.banThreshold} and is banned.`,
      //         cast
      //       );

      //       return json({ message: "User banned" });
      //     } else {
      //       await logModerationAction(
      //         moderatedChannel.id,
      //         "bypass",
      //         `User exceeded warn threshold of ${moderatedChannel.banThreshold} but is cohost.`,
      //         cast
      //       );
      //     }
      //   }
      // }

      for (const action of actions) {
        const actionFn = actionFunctions[action.type];

        await actionFn({
          channel: channel.id,
          cast,
          action,
        }).catch((e) => {
          Sentry.captureMessage(`Error in ${action.type} action`, {
            extra: {
              cast,
              action,
            },
          });
          console.error(e?.response?.data || e?.message || e);
          throw e;
        });

        console.log(
          `${action.type} @${cast.author.username}: ${ruleEvaluation.explanation}`
        );

        if (
          action.type === "ban" &&
          (await isCohost({
            fid: cast.author.fid,
            channel: channel.id,
          }))
        ) {
          await logModerationAction(
            moderatedChannel.id,
            "bypass",
            `User would be banned but is a cohost, doing nothing.`,
            cast
          );
          continue;
        }

        await logModerationAction(
          moderatedChannel.id,
          action.type,
          ruleEvaluation.explanation,
          cast
        );
      }
    }
  }
}

async function logModerationAction(
  moderatedChannelId: string,
  actionType: string,
  reason: string,
  cast: Cast
) {
  return db.moderationLog.create({
    data: {
      channelId: moderatedChannelId,
      action: actionType,
      reason,
      affectedUsername: cast.author.username,
      affectedUserAvatarUrl: cast.author.pfp_url,
      affectedUserFid: String(cast.author.fid),
      castHash: cast.hash,
    },
  });
}

async function evaluateRules(
  moderatedChannel: ModeratedChannel,
  cast: Cast,
  rule: Rule
): Promise<
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    }
> {
  if (rule.type === "CONDITION") {
    return evaluateRule(moderatedChannel, cast, rule);
  } else if (rule.type === "LOGICAL" && rule.conditions) {
    if (rule.operation === "AND") {
      const evaluations = await Promise.all(
        rule.conditions.map((subRule) =>
          evaluateRules(moderatedChannel, cast, subRule)
        )
      );
      if (evaluations.every((e) => e.didViolateRule)) {
        return {
          didViolateRule: true,
          failedRule: rule,
          explanation: `${evaluations
            // @ts-expect-error ts doesnt acknowledge `every`
            // in discriminated union
            .map((e) => e.explanation)
            .join(", ")}`,
        };
      } else {
        return { didViolateRule: false };
      }
    } else if (rule.operation === "OR") {
      const results = await Promise.all(
        rule.conditions.map((subRule) =>
          evaluateRules(moderatedChannel, cast, subRule)
        )
      );

      const violation = results.find((r) => r.didViolateRule);
      if (violation) {
        return violation;
      } else {
        return { didViolateRule: false };
      }
    }
  }

  return { didViolateRule: false };
}

async function evaluateRule(
  channel: ModeratedChannel,
  cast: Cast,
  rule: Rule
): Promise<
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    }
> {
  const check = ruleFunctions[rule.name];
  const error = await check({ channel, cast, rule });

  if (error) {
    return {
      didViolateRule: Boolean(error),
      failedRule: rule,
      explanation: error,
    };
  } else {
    return { didViolateRule: false };
  }
}

function isRuleTargetApplicable(target: string, cast: Cast) {
  switch (target) {
    case "all":
      return true;
    case "root":
      return cast.parent_hash == null;
    case "reply":
      return cast.parent_hash !== null;
    default:
      return true;
  }
}
