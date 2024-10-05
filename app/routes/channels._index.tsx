import { MetaFunction } from "@remix-run/node";

import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { ChannelCard } from "./~._index";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  {
    title: "Farcaster Channels Managed by ModBot",
  },
];
export async function loader() {
  const channels = await db.moderatedChannel.findMany({
    select: {
      id: true,
      imageUrl: true,
    },
  });

  return typedjson({ channels });
}

export default function Channels() {
  const { channels } = useTypedLoaderData<typeof loader>();

  return (
    <section className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2>All Channels</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {channels.map((channel) => (
          <Link to={`/channels/${channel.id}`} className="no-underline" key={channel.id} prefetch="intent">
            <ChannelCard channel={channel} />
          </Link>
        ))}
      </div>
    </section>
  );
}
