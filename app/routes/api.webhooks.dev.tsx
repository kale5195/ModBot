import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { webhookQueue } from "~/lib/bullish.server";
import { db } from "~/lib/db.server";
import { moderateCast } from "~/lib/warpcast.server";

// import { webhookQueue } from "~/lib/bullish.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // webhookQueue.add(
  //   "webhookQueue",
  //   {
  //     url: request.url,
  //   },
  //   {
  //     removeOnComplete: true,
  //     removeOnFail: 10_000,
  //   }
  // );
  const moderatedChannel = await db.moderatedChannel.findUnique({
    where: {
      id: "recaster",
    },
  });
  const cast = {
    object: "cast",
    hash: "0x8caaf21819195d581432cedf8791ad3a23a609fb",
    thread_hash: "0x8caaf21819195d581432cedf8791ad3a23a609fb",
    parent_hash: null,
    parent_url: "https://warpcast.com/~/channel/success",
    root_parent_url: "https://warpcast.com/~/channel/success",
    parent_author: { fid: null },
    author: {
      object: "user",
      fid: 7472,
      username: "goldie",
      display_name: "Goldie 🧟‍♂️",
      pfp_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/e3fd0b04-4f81-4778-9c39-d79b23fdc400/original",
      custody_address: "0x3f1686e4b5b8667dc65e33c31d5aa8677178fd4a",
      profile: { bio: { text: "Creative Director | Web3 artist | Frame dev | opensea.io/GoldiesNFTart" } },
      follower_count: 770,
      following_count: 394,
      verifications: ["0xb57381c7ed83bb9031a786d2c691cc6c7c2207a4"],
      verified_addresses: { eth_addresses: ["0xb57381c7ed83bb9031a786d2c691cc6c7c2207a4"], sol_addresses: [] },
      verified_accounts: [{ platform: "x", username: "GoldiesNFTart" }],
      active_status: "inactive",
      power_badge: false,
    },
    text: "Is this what /success all about? \n\nI get little to no traction on this app, in spite of me doing HELLA shit in web3 since i’ve been in the space. From Coinbase and Converse collabs, to selling out PFP collections in 24 hrs \n\nOh and been on live TV to talk about my art and this web3 shit 😤\n\nJust want a bit more recognition on here and not to be treated like a bot 😢 ..that too much to ask?",
    timestamp: "2024-10-20T00:53:24.000Z",
    embeds: [
      {
        url: "https://stream.warpcast.com/v1/video/7f0a5aa4849ca51bfbd0936a55c456b8.m3u8",
        metadata: { _status: "PENDING" },
      },
    ],
    reactions: { likes_count: 0, recasts_count: 0, likes: [], recasts: [] },
    replies: { count: 0 },
    channel: {
      object: "channel_dehydrated",
      id: "success",
      name: "The Success Syndicate",
      image_url: "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/9b8476f4-0809-4f5f-c629-97dc8745c700/original",
    },
    mentioned_profiles: [],
    event_timestamp: "2024-10-20T00:53:24.515Z",
  };
  //await check
  return json({
    message: "enqueued",
  });
}
