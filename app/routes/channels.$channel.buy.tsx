import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { frameResponse, getSharedEnv, parseMessageWithAirstack } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { baseClient } from "~/lib/viem.server";
import { db } from "~/lib/db.server";

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
  console.log(data.untrustedData);
  const transactionId = (data.untrustedData?.transactionId as `0x${string}` | undefined) || transactionIdFromUrl;
  if (!transactionId) {
    return frameResponse({
      title: "Internal error",
      image: getFrameImageUrl({
        message: "Transaction ID is required",
        color,
      }),
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
      return frameResponse({
        title: "Success",
        image: getFrameImageUrl({
          message: "Successfully joined channel",
          color,
        }),
      });
    }
  } catch (e) {
    console.error(e);
  }
  return frameResponse({
    title: "Pending",
    image: getFrameImageUrl({
      message: "Pending transaction",
      color,
    }),
    buttons: [
      {
        text: "Refresh",
        postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/buy?c=${color}&transactionId=${transactionId}`,
      },
      {
        text: "Contact Dev",
        link: `https://warpcast.com/~/inbox/create/3346?text=${encodeURIComponent(
          `Pending transaction when joining /${channelId}?`
        )}`,
      },
    ],
  });
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
    }),
    postUrl: `${getSharedEnv().hostUrl}/channels/${channelId}/buy?c=${color}`,
    buttons: [
      {
        text: `Join Now`,
        tx: `${getSharedEnv().hostUrl}/api/transaction/${channelId}`,
      },
    ],
  });
}
