import { LoaderFunctionArgs } from "@remix-run/node";
import axios from "axios";
import { typedjson } from "remix-typedjson";

export async function loader({ params }: LoaderFunctionArgs) {
  const channelId = params.id;
  if (!channelId) {
    return typedjson(
      {
        message: "Channel ID is required",
      },
      {
        status: 400,
      }
    );
  }

  // Need to proxy this due to CORS if fetched from browser
  const rsp = await axios.get(`https://api.warpcast.com/v1/channel?channelId=${channelId}`);

  return typedjson(rsp.data);
}
