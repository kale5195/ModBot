import { db } from "~/lib/db.server";
import { registerWebhook, unregisterWebhook } from "~/lib/neynar.server";

export async function toggleWebhook(args: { channelId: string; active: boolean }) {
  const { channelId, active } = args;
  const channel = await db.moderatedChannel.findUniqueOrThrow({
    where: {
      id: channelId,
    },
  });

  if (active) {
    registerWebhook({ rootParentUrl: channel.url! }).catch(console.error);
  } else {
    unregisterWebhook({ rootParentUrl: channel.url! }).catch(console.error);
  }
}
