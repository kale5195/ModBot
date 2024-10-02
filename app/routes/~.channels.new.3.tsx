/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { errorResponse, formatZodError, requireUser } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";
import { FieldLabel } from "~/components/ui/fields";
import { ClientOnly } from "remix-utils/client-only";
import { UserPicker } from "~/components/user-picker";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { permissionDefs } from "~/lib/permissions.server";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { registerWebhook } from "~/lib/neynar.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);

  if (!url.searchParams.has("channelId")) {
    throw redirect("/~/channels/new/1");
  }

  if (!url.searchParams.has("feed")) {
    throw redirect("/~/channels/new/2");
  }

  const channel = await getWarpcastChannel({ channel: url.searchParams.get("channelId")! });

  return typedjson({
    user,
    channel,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const data = await request.json();

  const result = z
    .object({
      comods: z
        .array(
          z.object({
            value: z.number(),
            label: z.string(),
            icon: z.string().optional(),
          })
        )
        .optional()
        .default([]),
      channelId: z.string(),
      feed: z.enum(["recommended", "custom", "manual"]),
    })
    .safeParse(data);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  const wcChannel = await getWarpcastChannel({ channel: result.data.channelId });

  if (wcChannel.leadFid !== +user.id) {
    throw redirect("/403");
  }

  const existingChannel = await db.moderatedChannel.findUnique({
    where: {
      id: result.data.channelId,
    },
  });

  if (existingChannel) {
    throw redirect(`/~/channels/new/4?channelId=${result.data.channelId}`);
  }

  function getRulesForFeedType(args: { feed: "recommended" | "custom" | "manual" }) {
    const { feed } = args;
    if (feed === "recommended" || feed === "custom") {
      return {
        excludeCohosts: true,
        inclusionRuleSet: JSON.stringify({
          rule: {
            name: "or",
            type: "LOGICAL",
            args: {},
            operation: "OR",
            conditions: [
              {
                name: "userDoesNotHoldPowerBadge",
                type: "CONDITION",
                args: {},
              },
              {
                name: "userIsNotFollowedBy",
                type: "CONDITION",
                args: {
                  users: [
                    {
                      value: +user.id,
                      label: user.name,
                      icon: user.avatarUrl ?? undefined,
                    },
                  ],
                },
              },
            ],
          },
          actions: [
            {
              type: "like",
            },
          ],
        }),
        exclusionRuleSet: JSON.stringify({
          rule: {},
          actions: [
            {
              type: "hideQuietly",
            },
          ],
        }),
      };
    } else {
      return {
        excludeCohosts: true,
      };
    }
  }

  const ruleSets = getRulesForFeedType({ feed: result.data.feed });

  const moderatedChannel = await db.moderatedChannel.create({
    data: {
      id: result.data.channelId,
      active: false,
      userId: user.id,
      url: wcChannel.url,
      feedType: result.data.feed,
      imageUrl: wcChannel.imageUrl,

      ...ruleSets,
    },
  });

  // await Promise.all([
  //   db.role.create({
  //     data: {
  //       channelId: moderatedChannel.id,
  //       name: "Cohost",
  //       isCohostRole: true,
  //       description: "Primary moderators for your channel.",
  //       permissions: JSON.stringify(permissionDefs.map((p) => p.id)),
  //       delegates: {
  //         create: result.data.comods.map((comod) => ({
  //           fid: String(comod.value),
  //           username: comod.label,
  //           avatarUrl: comod.icon,
  //           channelId: moderatedChannel.id,
  //         })),
  //       },
  //     },
  //   }),
  //   await registerWebhook({
  //     rootParentUrl: wcChannel.url,
  //   }),
  // ]);
  return redirect(`/~/channels/${moderatedChannel.id}`);
  return redirect(`/~/channels/new/4?channelId=${moderatedChannel.id}`);
}

export default function Screen() {
  const { channel } = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const methods = useForm({
    shouldFocusError: false,
    criteriaMode: "all",
  });

  const onSubmit = (data: any) => {
    const url = new URL(window.location.href);

    fetcher.submit(
      {
        comods: data.comods,
        channelId: channel.id,
        feed: url.searchParams.get("feed")!,
      },
      {
        method: "post",
        encType: "application/json",
      }
    );
  };

  return (
    <FormProvider {...methods}>
      <Card>
        <CardHeader>
          <ChannelHeader channel={channel} />
          <CardTitle>Set @modbot as your channel's moderator</CardTitle>
          <CardDescription>
            @modbot will auto invite people who meet your channel rules. You can also remove the people @modbot invited
            at any time.
            <div className="mt-1 text-red-500">
              You can do this step at October 4th, 2024,, otherwise it will break your existing channnel feeds.
            </div>
          </CardDescription>
        </CardHeader>
        <form method="post" className="space-y-8" onSubmit={methods.handleSubmit(onSubmit)}>
          <CardFooter>
            <Button type="submit" className="w-full sm:w-[150px]">
              Next
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}

export function ChannelHeader(props: { channel: { imageUrl: string | null; id: string } }) {
  const { channel } = props;

  if (!channel.imageUrl) {
    return <span>nothign</span>;
  }

  return (
    <div className="flex gap-2 items-center mb-4 text-sm text-muted-foreground" style={{ fontFamily: "Kode Mono" }}>
      <img src={channel.imageUrl} alt="" className="h-5 w-5 rounded-full drop-shadow-sm border-2 border-white" />/
      {channel.id}
    </div>
  );
}
