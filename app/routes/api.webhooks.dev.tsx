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
  const res = await moderateCast({ hash: "0x674583f8124989578c20e93790316af71fd3e4db", action: "hide" });
  console.log(res);
  return json({
    message: "enqueued",
  });
}
