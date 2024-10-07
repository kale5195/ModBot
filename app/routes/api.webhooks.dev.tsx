import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { webhookQueue } from "~/lib/bullish.server";

// import { webhookQueue } from "~/lib/bullish.server";

export async function loader({ request }: LoaderFunctionArgs) {
  webhookQueue.add(
    "webhookQueue",
    {
      url: request.url,
    },
    {
      removeOnComplete: true,
      removeOnFail: 10_000,
    }
  );
  return json({
    message: "enqueued",
  });
}
