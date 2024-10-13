import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { frameResponse, getSharedEnv, parseMessageWithAirstack } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { baseClient } from "~/lib/viem.server";
import { db } from "~/lib/db.server";
import { inviteToChannel } from "~/lib/neynar.server";

function getFrameImageUrl(props: { message: string; channel?: string; color?: string | null }) {
  const { message, channel, color } = props;
  return `${getSharedEnv().hostUrl}/api/images?message=${message}${channel ? `&channel=${channel}` : ""}${
    color ? `&c=${color}` : ""
  }`;
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const url = new URL(request.url);
  const color = url.searchParams.get("c");
  const transactionIdFromUrl = url.searchParams.get("transactionId") as `0x${string}` | undefined;
  const data = await request.json();
  const user = await parseMessageWithAirstack(data);
  const transactionId = (data.untrustedData?.transactionId as `0x${string}` | undefined) || transactionIdFromUrl;
  if (!transactionId) {
    return frameResponse({
      title: "Internal error",
      image: getFrameImageUrl({
        message: "Transaction ID is required",
        color,
      }),
      buttons: [
        {
          text: "Contact Dev",
          link: `https://warpcast.com/~/inbox/create/3346?text=${encodeURIComponent(
            `Transaction error when joining /${channelId}?`
          )}`,
        },
      ],
    });
  }
  try {
    const tx = await baseClient.getTransaction({ hash: transactionId });
    if (tx.input && tx.input !== "0x") {
      const decodedData = Buffer.from(tx.input.slice(2), "hex").toString();
      const jsonStartIndex = decodedData.indexOf("{");
      const jsonEndIndex = decodedData.lastIndexOf("}") + 1;
      const jsonData = decodedData.slice(jsonStartIndex, jsonEndIndex);
      const parsedData = JSON.parse(jsonData) as { id: string };
      const channelOrderId = parsedData.id;
      await db.channelOrder.update({
        where: { id: channelOrderId },
        data: { status: 1, txHash: transactionId },
      });
      await inviteToChannel({ channelId, fid: user.fid });
      await db.moderationLog.updateMany({
        where: {
          affectedUserFid: user.fid.toString(),
          channelId,
          action: "hideQuietly",
          reason: {
            contains: "Membership fee required",
          },
        },
        data: {
          action: "like",
          actor: "system",
          reason: `Membership fee paid`,
        },
      });
      return frameResponse({
        title: "Success",
        image: getFrameImageUrl({
          message: "Invite sent!",
          color,
        }),
        buttons: [
          {
            text: "Check Notifications",
            link: `https://warpcast.com/~/notifications/channel-role-invites?groupId=channels%21channel-role-invite%3Amember`,
          },
        ],
      });
    }
  } catch (e) {
    console.log("failed to get transaction");
  }
  return frameResponse({
    title: "Pending",
    image: "https://cdn.recaster.org/tx_loading.gif",
    buttons: [
      {
        text: "Refresh",
        postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/paid?c=${color}&transactionId=${transactionId}`,
      },
    ],
  });
}
