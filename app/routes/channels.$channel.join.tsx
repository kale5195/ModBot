import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { frameResponse, getSharedEnv, parseMessage } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { validateCast } from "~/lib/automod.server";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { isChannelInvited, isChannelMember, isFollowingChannel } from "~/lib/warpcast.server";

function getFrameImageUrl(props: { message: string; channel?: string }) {
  const { message, channel } = props;
  return `${getSharedEnv().hostUrl}/api/images?message=${message}${channel ? `&channel=${channel}` : ""}`;
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  try {
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
        }),
        buttons: [
          {
            text: "Go to ModBot",
            link: `${getSharedEnv().hostUrl}`,
          },
        ],
      });
    }
    const data = await request.json();
    const message = await parseMessage(data);
    const user = message.action.interactor as User;
    // TODO may need async check, queue
    // rate limit
    // check if a member
    const isMember = await isChannelMember({ channel: channelId, fid: user.fid });
    if (isMember) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: `You are already a member of /${channelId}`,
        image: getFrameImageUrl({
          message: `You are already a member of /${channelId}`,
          channel: channelId,
        }),
        buttons: [
          {
            text: "Go to channel",
            link: `https://warpcast.com/~/channel/${channelId}`,
          },
        ],
      });
    }
    // check if followed
    const isFollowed = await isFollowingChannel({ channel: channelId, fid: user.fid });
    if (!isFollowed) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: "Join the channel through ModBot.",
        image: getFrameImageUrl({
          message: `Please follow /${channelId} first`,
          channel: channelId,
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

    // check if invited
    const isInvited = await isChannelInvited({ channel: channelId, fid: user.fid });

    if (isInvited) {
      return frameResponse({
        title: `Join ${channelId}`,
        description: "Join the channel through ModBot.",
        image: getFrameImageUrl({
          message: "You are already invited!",
          channel: channelId,
        }),
        buttons: [
          {
            text: "Accept Invite",
            link: `https://warpcast.com/~/notifications`,
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
    return frameResponse({
      title: `Join ${channelId}`,
      description: "Join the channel through ModBot.",
      image: getFrameImageUrl({
        message:
          action === "like" ? "Invite sent!" : log.reason.length < 50 ? log.reason : "You are not eligible to join",
        channel: channelId,
      }),
      postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/join`,
      buttons:
        action === "like"
          ? [
              {
                text: "Accept Invite",
                link: `https://warpcast.com/~/notifications`,
              },
            ]
          : [
              {
                text: "Try again",
              },
              {
                text: "Check rules",
                link: `${getSharedEnv().hostUrl}/channels/${channelId}`,
              },
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
    const errorMessage = error.response?.data?.message?.[0]?.message || "Internal error, try again later.";
    return frameResponse({
      title: "Internal error",
      description: errorMessage,
      image: getFrameImageUrl({
        message: errorMessage,
      }),
      buttons: [
        {
          text: "Try again",
        },
      ],
    });
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const channel = await db.moderatedChannel.findFirst({
    where: {
      id: channelId,
    },
  });

  if (!channel) {
    return frameResponse({
      title: `/${channelId} not configured`,
      description: `/${channelId} is not configured to use ModBot`,
      image: getFrameImageUrl({
        message: `/${channelId} is not configured to use ModBot`,
      }),
      buttons: [
        {
          text: "Go to ModBot",
          link: `${getSharedEnv().hostUrl}`,
        },
      ],
    });
  }
  return frameResponse({
    title: `Welcome to ${channelId}`,
    description: "Join the channel through ModBot.",
    image: getFrameImageUrl({
      message: `Welcome to /${channelId}`,
      channel: channelId,
    }),
    postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/join`,
    buttons: [
      {
        text: `Join Now`,
      },
      {
        text: "Check rules",
        link: `${getSharedEnv().hostUrl}/channels/${channelId}`,
      },
    ],
  });
}