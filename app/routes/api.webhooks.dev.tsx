import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { holdingFanTokenBalance } from "~/lib/airstack.server";
import { webhookQueue } from "~/lib/bullish.server";
import { validateCast } from "~/lib/cast-mod.server";
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
  // await moderateCast({ hash: "0x35e4abdaf2a2f08cb6452f8ea86a29f116bb680f", action: "hide" });
  const balance = await holdingFanTokenBalance({ fid: 548932, symbol: "cid:wac" });
  console.log(balance);
  return json({
    message: "enqueued",
  });
}
