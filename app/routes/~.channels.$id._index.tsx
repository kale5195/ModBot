/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import { abbreviateNumber } from "js-abbreviation-number";

import { typeddefer, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Await } from "@remix-run/react";
import { actionDefinitions } from "~/lib/validations.server";
import { Suspense } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { ModerationStats30Days, getModerationStats30Days } from "~/lib/stats.server";
import { Badge } from "~/components/ui/badge";

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

  return (
    <div>
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
