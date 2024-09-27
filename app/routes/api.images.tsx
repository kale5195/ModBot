import { LoaderFunctionArgs } from "@remix-run/node";
import { CSSProperties } from "react";
import satori from "satori";
import { convertSvgToPngBase64, getSharedEnv } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const message = url.searchParams.get("message") || "Hello";
  const channel = url.searchParams.get("channel") || "";

  const imageBase64 = await generateFrame({ message, channel });
  const base64Data = imageBase64.split(",")[1];
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Return the image as a response
  return new Response(imageBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function generateFrame(props: { message: string; channel: string }) {
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
      {Boolean(props.channel) && (
        <img
          src={`https://preview.recaster.org/api/avatar/channel/${props.channel}`}
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
