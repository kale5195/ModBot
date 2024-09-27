import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { convertSvgToPngBase64, frameResponse, getSharedEnv, parseMessage } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { CSSProperties } from "react";
import satori from "satori";
import { validateCast } from "~/lib/automod.server";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const channel = await db.moderatedChannel.findFirst({
    where: {
      id: channelId,
    },
    include: {
      user: true,
      roles: {
        include: {
          delegates: true,
        },
      },
      comods: true,
    },
  });
  if (!channel) {
    throw new Error("Channel not found");
  }
  const data = await request.json();
  const message = await parseMessage(data);
  const logs = await validateCast({
    user: message.action.interactor as User,
    moderatedChannel: channel,
    simulation: false,
  });
  const log = logs[0];
  const action = log.action;
  return frameResponse({
    title: `Join ${channelId}`,
    description: "Join the channel through automod.",
    image: await generateFrame({
      message: action === "like" ? "Invite sent!" : "You are not eligible to join",
      channelAvatarUrl: `https://preview.recaster.org/api/avatar/channel/${channelId}`,
    }),
    postUrl: `${getSharedEnv().hostUrl}/frames/${channelId}/invite`,
    buttons:
      action === "like"
        ? [
            {
              text: "Accept Invite",
              link: `https://warpcast.com`,
            },
          ]
        : [
            {
              text: "Check rules",
              link: `${getSharedEnv().hostUrl}/channels/${channelId}`,
            },
          ],
    cacheTtlSeconds: 3600,
  });
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.channel, "channel id is required");

  const channel = await db.moderatedChannel.findFirst({
    where: {
      id: params.channel,
    },
  });

  if (!channel) {
    return frameResponse({
      title: "Channel not configured",
      description: "This channel is not configured to use ModBot.",
      image: await generateFrame({
        message: "This channel is not configured to use ModBot.",
      }),
    });
  }
  const channelId = channel.id;
  return frameResponse({
    title: `Welcome to ${channelId}`,
    description: "Join the channel through automod.",
    image: await generateFrame({
      message: `Welcome to /${channelId}`,
      channelAvatarUrl: `https://preview.recaster.org/api/avatar/channel/${channelId}`,
    }),
    postUrl: `${getSharedEnv().hostUrl}/frames/${channelId}/join`,
    buttons: [
      {
        text: "Join Now",
      },
    ],
    cacheTtlSeconds: 3600,
  });
}

async function generateFrame(props: { message: string; channelAvatarUrl?: string }) {
  const response = await fetch(`${getSharedEnv().hostUrl}/fonts/kode-mono-bold.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const styles: CSSProperties = {
    display: "flex",
    color: "white",
    fontFamily: "Kode Mono",
    backgroundColor: "rgba(237,3,32,0.87) 20.8%",
    backgroundImage:
      "radial-gradient(circle farthest-corner at 10% 20%, rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4%)",
    height: "100%",
    width: "100%",
    padding: 72,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 38,
    fontWeight: 600,
  };

  const svg = await satori(
    <div style={styles}>
      {props.channelAvatarUrl && (
        <img
          src={props.channelAvatarUrl}
          style={{
            height: 120,
            width: 120,
            borderRadius: 100,
            marginBottom: 50,
          }}
        />
      )}
      {props.message}
    </div>,
    {
      width: 800,
      height: 418,
      fonts: [
        {
          name: "Kode Mono",
          data: fontBuffer,
          style: "normal",
        },
      ],
    }
  );

  return convertSvgToPngBase64(svg);
}
