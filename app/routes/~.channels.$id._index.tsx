/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { abbreviateNumber } from "js-abbreviation-number";

import { typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Await, useFetcher, Form } from "@remix-run/react";
import { actionDefinitions } from "~/lib/validations.server";
import { Suspense, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { ModerationStats30Days, getModerationStats30Days } from "~/lib/stats.server";
import { Button } from "~/components/ui/button";
import { useClipboard } from "~/lib/utils";
import ColorPicker from "~/components/color-picker";
import { db } from "~/lib/db.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const channelId = params.id;
  invariant(channelId, "Channel ID is required");
  const formData = await request.formData();
  const color = formData.get("color") as string;

  await db.moderatedChannel.update({
    where: { id: channelId },
    data: { frames: JSON.stringify({ bgColor: color }) },
  });
  return typedjson({ success: true });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  // const stats = getChannelStats({ channelId: channel.id });
  // const topUsers = getTopEngagers({ channelId: channel.id });
  const moderationStats = getModerationStats30Days({ channelId: channel.id });

  return typeddefer({
    user,
    channel,
    actionDefinitions: actionDefinitions,
    env: getSharedEnv(),
    // channelStats: stats,
    moderationStats,
    // topUsers,
  });
}

export default function Screen() {
  const { channel, moderationStats } = useTypedLoaderData<typeof loader>();
  const { copy, copied } = useClipboard();
  const fetcher = useFetcher();

  function getFrameUrl() {
    const color = channel.framesParsed.bgColor;
    if (color === "#ea580c") {
      return `https://modbot.sh/channels/${channel.id}/join`;
    }
    return `https://modbot.sh/channels/${channel.id}/join?c=${color.replace("#", "")}`;
  }
  function handleColorChange(newColor: string | null) {
    if (newColor) {
      fetcher.submit({ color: newColor }, { method: "post" });
    }
  }
  return (
    <div>
      <div>
        <p className="font-medium">Invite Channel Members with Frames</p>
        <p className="text-sm text-gray-500">Add this frame URL to your channel settings.</p>
        <p className="mt-1 text-sm text-gray-500">
          Share this link only after you set <span className="font-medium text-primary">@modbot</span> as channel
          moderator.
        </p>
        <div className="mt-2 rounded-lg border bg-card text-card-foreground shadow p-4 ">
          <p className="text-base font-medium" style={{ color: channel.framesParsed.bgColor }}>
            {getFrameUrl()}
          </p>
          <div className="flex flex-row gap-4 mt-4 items-center flex-wrap">
            <Button variant={"secondary"} onClick={() => copy(getFrameUrl())} className="min-w-[80px]">
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant={"secondary"}
              onClick={() =>
                window.open(
                  `https://warpcast.com/~/developers/frames?url=${encodeURIComponent(getFrameUrl())}`,
                  "_blank"
                )
              }
              className="min-w-[80px]"
            >
              Preview
            </Button>
            <ColorPicker setColor={handleColorChange} />
          </div>
        </div>
      </div>

      {moderationStats !== null && (
        <div className="mt-6">
          <div>
            <p className="mb-1 font-medium">Moderation</p>
          </div>
          <Suspense fallback={<ActivityStatsLoading />}>
            <Await resolve={moderationStats!}>{(moderationStats) => <ActivityStats stats={moderationStats!} />}</Await>
          </Suspense>
        </div>
      )}
    </div>
  );
}

export function ActivityStatsLoading() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="w-full">
          <CardHeader className="flex flex-col gap-4">
            <Skeleton className="w-[75px] h-[10px] rounded-full" />
            <Skeleton className="w-[50px] h-[10px] rounded-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ActivityStats(props: { stats: ModerationStats30Days }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="w-md sm:w-lg">
        <CardHeader>
          <CardDescription>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="border-b border-dashed">Curation Rate</TooltipTrigger>
                <TooltipContent>
                  <p>The % of members invited into the channel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {Math.round(props.stats.approvalRate * 100)}%
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-md sm:w-lg">
        <CardHeader>
          <CardDescription>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="border-b border-dashed">Curated Members</TooltipTrigger>
                <TooltipContent>
                  <p>The unique number of members invited into the channel.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(props.stats.uniqueCasters)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
