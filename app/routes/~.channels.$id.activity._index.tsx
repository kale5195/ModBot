/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import {
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Form, Link, NavLink } from "@remix-run/react";
import { actionDefinitions, like } from "~/lib/validations.server";
import { Alert } from "~/components/ui/alert";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { inviteToChannel } from "~/lib/warpcast.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const { page, pageSize, skip } = getPageInfo({ request });

  const [moderationLogs, totalModerationLogs] = await Promise.all([
    db.moderationLog.findMany({
      where: {
        channelId: channel.id,
      },
      take: pageSize,
      skip,
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.moderationLog.count({
      where: {
        channelId: channel.id,
      },
    }),
  ]);

  return typeddefer({
    user,
    channel,
    moderationLogs,
    actionDefinitions: actionDefinitions,
    env: getSharedEnv(),
    page,
    pageSize,
    total: totalModerationLogs,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      logId: z.string(),
      intent: z.enum(["like"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return typedjson(
      {
        message: "Invalid data",
      },
      { status: 422 }
    );
  }

  const log = await db.moderationLog.findUnique({
    where: {
      id: result.data.logId,
    },
  });

  if (!log) {
    return typedjson(
      {
        message: "Log not found",
      },
      { status: 404 }
    );
  }

  if (result.data.intent === "like") {
    console.log("approve", log.affectedUsername);
    try {
      await inviteToChannel({ channelId: moderatedChannel.id, fid: Number(log.affectedUserFid) });
    } catch (e) {
      return typedjson(
        {
          message: "Failed to invite user",
        },
        { status: 404 }
      );
    }
    await db.moderationLog.update({
      where: {
        id: log.id,
      },
      data: {
        action: "like",
        actor: user.id,
        reason: `Applied manually by @${user.name}`,
      },
    });
  } else {
    return typedjson(
      {
        message: "Invalid intent",
      },
      { status: 422 }
    );
  }

  return typedjson({
    message: "success",
  });
}

export default function Screen() {
  const { page, pageSize, total, moderationLogs, actionDefinitions, channel } = useTypedLoaderData<typeof loader>();

  const prevPage = Math.max(page - 1, 0);
  const nextPage = page + 1 > Math.ceil(total / pageSize) ? null : page + 1;

  return (
    <div>
      <div className="flex justify-between border-b">
        <div id="log-top" className="flex flex-row items-center mb-4">
          <p className="font-semibold">Activity</p>
          <div className="flex gap-2 ml-8">
            <Button variant={"link"} className="">
              Members
            </Button>
            <Link to={`/~/channels/${channel.id}/activity/casts`}>
              <Button variant={"link"} className="text-gray-600">
                Hidden Casts
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {moderationLogs.length === 0 ? (
        <Alert className="mt-2">
          <div className="text-gray-700">
            No moderation logs yet. Anytime ModBot executes an action a log will show here.
          </div>
        </Alert>
      ) : (
        <>
          <div className="divide-y">
            {moderationLogs.map((log) => (
              <div
                key={log.id}
                className={`flex flex-col md:flex-row gap-2 p-2 ${log.action === "like" ? "bg-green-50" : "bg-red-50"}`}
              >
                <p className="text-xs w-[150px] text-gray-400 shrink-0 sm:shrink-1" title={log.createdAt.toISOString()}>
                  {log.createdAt.toLocaleString()}
                </p>
                <div className="flex gap-2 w-full items-start">
                  <a
                    className="no-underline"
                    target="_blank"
                    href={`https://warpcast.com/${log.affectedUsername}`}
                    rel="noreferrer"
                  >
                    <Avatar className="block w-11 h-11">
                      <AvatarImage src={log.affectedUserAvatarUrl ?? undefined} alt={"@" + log.affectedUsername} />
                      <AvatarFallback>{log.affectedUsername.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                    </Avatar>
                  </a>
                  <div className="flex flex-col w-full">
                    <p className="font-semibold">
                      <a href={`https://warpcast.com/${log.affectedUsername}`} target="_blank" rel="noreferrer">
                        @{log.affectedUsername}
                      </a>
                    </p>
                    <p className="break-word text-sm overflow-ellipsis overflow-hidden">
                      {actionDefinitions[log.action as keyof typeof actionDefinitions].friendlyName},{" "}
                      {formatText(log.reason)}
                    </p>
                  </div>
                  {log.action === "hideQuietly" && (
                    <Form method="post">
                      <input type="hidden" name="logId" value={log.id} />
                      <Button name="intent" value="like" variant={"outline"} className="w-full h-full text-left">
                        Invite
                      </Button>
                    </Form>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-between">
            <Button variant={"outline"} size={"sm"} className="no-underline" disabled={prevPage === 0} asChild>
              <NavLink
                preventScrollReset
                to={`?page=${prevPage}&pageSize=${pageSize}`}
                prefetch="intent"
                className={`text-gray-500 ${prevPage === 0 ? "cursor-not-allowed pointer-events-none opacity-50" : ""}`}
                onClick={(e) => {
                  if (prevPage !== 0) {
                    document.getElementById("log-top")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                <ChevronLeftIcon className="w-4 h-4 inline" />
                Previous
              </NavLink>
            </Button>
            <Button variant={"outline"} size={"sm"} className="no-underline" disabled={nextPage === null} asChild>
              <NavLink
                preventScrollReset
                to={`?page=${nextPage}&pageSize=${pageSize}`}
                prefetch="intent"
                className={`text-gray-500 ${
                  nextPage === null ? "cursor-not-allowed pointer-events-none opacity-50" : ""
                }`}
                onClick={(e) => {
                  if (nextPage !== null) {
                    document.getElementById("log-top")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                Next
                <ChevronRightIcon className="w-4 h-4 inline" />
              </NavLink>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function formatText(text: string): string {
  const datePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;

  const matches = text.match(datePattern) ?? [];
  if (matches.length) {
    for (const match of matches) {
      const date = new Date(match);
      const localTimeString = date.toLocaleString();
      text = text.replace(match, localTimeString);
    }

    return text;
  } else {
    return text;
  }
}

const defaultPageSize = 50;

function getPageInfo({ request }: { request: Request }) {
  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
  const pageSize = Math.max(Math.min(parseInt(url.searchParams.get("pageSize") || `${defaultPageSize}`), 100), 0);
  const skip = (page - 1) * pageSize;

  return {
    page: isNaN(page) ? 1 : page,
    pageSize: isNaN(pageSize) ? defaultPageSize : pageSize,
    skip: isNaN(skip) ? 0 : skip,
  };
}
