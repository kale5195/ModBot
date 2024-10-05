import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { frameResponse, getSetCache, getSharedEnv, parseMessage } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { validateCast } from "~/lib/automod.server";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import {
  getWarpcastChannel,
  isBannedByChannel,
  isChannelInvited,
  isChannelMember,
  isFollowingChannel,
} from "~/lib/warpcast.server";

function getFrameImageUrl(props: { message: string; channel?: string; color?: string | null }) {
  const { message, channel, color } = props;
  return `${getSharedEnv().hostUrl}/api/images?message=${message}${channel ? `&channel=${channel}` : ""}${
    color ? `&c=${color}` : ""
  }`;
}

async function rateLimit(key: string): Promise<boolean> {
  const cacheKey = `ratelimit:${key}`;
  const now = Date.now();
  const ttlSeconds = 30;
  return getSetCache({
    key: cacheKey,
    ttlSeconds,
    get: async () => now,
  }).then((lastActionTime) => {
    const diff = now - lastActionTime;
    // console.log("diff", diff);
    return diff <= ttlSeconds * 1000 && diff > 0;
  });
}

function getDeclinedReasons(reason: string) {
  if (reason.includes("Need manual approval by channel moderators")) {
    return "Need manual approval by channel moderators";
  }
  return reason.length < 50 ? reason : "You are not eligible to join";
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const url = new URL(request.url);
  const color = url.searchParams.get("c");
  try {
    const data = await request.json();
    // TODO may need async check, queue
    const channel = await db.moderatedChannel.findFirst({
      where: {
        id: channelId,
      },
      include: {
        user: true,
      },
    });
    if (!channel) {
      return frameResponse({
        title: `/${channelId} not configured`,
        description: `/${channelId} is not configured to use ModBot`,
        image: getFrameImageUrl({
          message: `/${channelId} is not configured to use ModBot`,
          color,
        }),
        buttons: [
          {
            text: "Go to ModBot",
            link: `${getSharedEnv().hostUrl}`,
          },
        ],
      });
    }
    const message = await parseMessage(data);
    const user = message.action.interactor as User;
    // check if following
    const isFollowing = await isFollowingChannel({ channel: channelId, fid: user.fid });
    if (!isFollowing) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: "Join the channel through ModBot.",
        image: getFrameImageUrl({
          message: `Please follow /${channelId} first`,
          channel: channelId,
          color,
        }),
        buttons: [
          {
            text: "Follow Channel",
            link: `https://warpcast.com/~/channel/${channelId}`,
          },
          {
            text: "Try again",
          },
        ],
      });
    }

    // check if a member
    const isMember = await isChannelMember({ channel: channelId, fid: user.fid });
    if (isMember) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: `You are already a member of /${channelId}`,
        image: getFrameImageUrl({
          message: `You are already a member of /${channelId}`,
          channel: channelId,
          color,
        }),
        buttons: [
          {
            text: "Go to channel",
            link: `https://warpcast.com/~/channel/${channelId}`,
          },
        ],
      });
    }

    // check if invited
    const isInvited = await isChannelInvited({ channel: channelId, fid: user.fid });

    if (isInvited) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: "Join the channel through ModBot.",
        image: getFrameImageUrl({
          message: "You are already invited!",
          channel: channelId,
          color,
        }),
        buttons: [
          {
            text: "Check Notifications",
            link: `https://warpcast.com/~/notifications`,
          },
        ],
      });
    }
    // rate limit
    const isRateLimited = await rateLimit(`join:${channelId}:${user.fid}`);
    if (isRateLimited) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: "Too fast, try again later",
        image: getFrameImageUrl({
          message: "Too fast, try again later",
          channel: channelId,
          color,
        }),
        buttons: [
          {
            text: "Try again",
          },
        ],
      });
    }
    // check if banned by channel
    const isBanned = await isBannedByChannel({ channel: channelId, fid: user.fid });
    if (isBanned) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: `You are banned from /${channelId}`,
        image: getFrameImageUrl({
          message: `You are banned from /${channelId}`,
          channel: channelId,
          color,
        }),
        buttons: [
          {
            text: "Go to channel",
            link: `https://warpcast.com/~/channel/${channelId}`,
          },
        ],
      });
    }

    const logs = await validateCast({
      user: user,
      moderatedChannel: channel,
      simulation: false,
    });
    const log = logs[0];
    // console.log("log", log);
    const action = log.action;
    const needChannelFanToken = log.reason.includes("Channel Fan Token");
    return frameResponse({
      title: `Join ${channelId}`,
      description: "Join the channel through ModBot.",
      image: getFrameImageUrl({
        message: action === "like" ? "Invite sent!" : getDeclinedReasons(log.reason),
        channel: channelId,
        color,
      }),
      postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/join`,
      buttons:
        action === "like"
          ? [
              {
                text: "Check Notifications",
                link: `https://warpcast.com/~/notifications`,
              },
            ]
          : [
              {
                text: "Try again",
              },
              {
                text: "Check Reason",
                link: `${getSharedEnv().hostUrl}/channels/${channelId}?fid=${user.fid}`,
              },
              ...(needChannelFanToken
                ? [
                    {
                      text: "Buy Fan Token",
                      target: `https://moxie-frames.airstack.xyz/stim/frame?f=3&r=19&t=cid_${channelId}`,
                    },
                  ]
                : [
                    {
                      text: "DC Moderator",
                      link: `https://warpcast.com/~/inbox/create/${channel.userId}?text=${encodeURIComponent(
                        `Could you add me to /${channelId}?`
                      )}`,
                    },
                  ]),
            ],
    });
  } catch (e) {
    const error = e as {
      response: {
        data: {
          message: [
            {
              message: string;
            }
          ];
        };
      };
    };
    console.log("error", JSON.stringify(error, null, 2));
    const wcChannel = await getWarpcastChannel({ channel: channelId });
    const hasModerator = wcChannel.moderatorFids.includes(861203);
    const errorMessage = hasModerator
      ? error.response?.data?.message?.[0]?.message || "Internal error, try again later"
      : "Please ask channel owner set @modbot as moderator";
    return frameResponse({
      title: "Internal error",
      description: errorMessage,
      image: getFrameImageUrl({
        message: errorMessage,
        color,
      }),
      buttons: hasModerator
        ? [
            {
              text: "Try again",
            },
            {
              text: "Contact Dev",
              link: `https://warpcast.com/~/inbox/create/3346?text=${encodeURIComponent(
                `Internal error when joining /${channelId}?`
              )}`,
            },
          ]
        : [
            {
              text: "DC Owner",
              link: `https://warpcast.com/~/inbox/create/${wcChannel.leadFid}?text=${encodeURIComponent(
                `Please set @modbot as moderator for /${channelId}?`
              )}`,
            },
          ],
    });
  }
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const url = new URL(request.url);
  const color = url.searchParams.get("c") || "ea580c";
  return frameResponse({
    title: `Welcome to ${channelId}`,
    description: "Join the channel through ModBot.",
    image: getFrameImageUrl({
      message: `Welcome to /${channelId}`,
      channel: channelId,
      color,
    }),
    postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/join?c=${color}`,
    buttons: [
      {
        text: `Join Now`,
      },
      {
        text: "Who can join?",
        link: `${getSharedEnv().hostUrl}/channels/${channelId}`,
      },
    ],
  });
}
