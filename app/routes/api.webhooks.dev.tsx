import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { webhookQueue } from "~/lib/bullish.server";
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
  const res = await moderateCast({ hash: "0x96f1e3c498ccab877595d3362e5611c13dd0e811", action: "unhide" });
  console.log(res);
  return json({
    message: "enqueued",
  });
}
