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
import { ArrowUpRight, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { z } from "zod";
import { useLocalStorage } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { unlike } from "~/lib/automod.server";
import { inviteToChannel } from "~/lib/neynar.server";
import { moderateCast } from "~/lib/warpcast.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const { page, pageSize, skip } = getPageInfo({ request });

  const [moderationLogs, totalModerationLogs] = await Promise.all([
    db.castLog.findMany({
      where: {
        channelId: channel.id,
        status: 1,
      },
      take: pageSize,
      skip,
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.castLog.count({
      where: {
        channelId: channel.id,
        status: 1,
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
      hash: z.string(),
      intent: z.enum(["unhide"]),
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

  const log = await db.castLog.findUnique({
    where: {
      hash: result.data.hash,
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

  if (result.data.intent === "unhide") {
    console.log("unhide", log.hash);
    try {
      // await inviteToChannel({ channelId: moderatedChannel.id, fid: Number(log.authorFid) });
      await moderateCast({ action: "unhide", hash: log.hash });
    } catch (e) {
      return typedjson(
        {
          message: "Failed to unhide cast",
        },
        { status: 404 }
      );
    }
    await db.castLog.update({
      where: {
        hash: log.hash,
      },
      data: {
        status: 0,
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
            <Link to={`/~/channels/${channel.id}/activity`}>
              <Button variant={"link"} className="text-gray-600">
                Members
              </Button>
            </Link>
            <Button variant={"link"} className="">
              Hidden Casts
            </Button>
          </div>
        </div>
      </div>
      {moderationLogs.length === 0 ? (
        <Alert className="mt-2">
          <div className="text-gray-700">No moderation logs yet.(Beta testing)</div>
        </Alert>
      ) : (
        <>
          <div className="divide-y">
            {moderationLogs.map((log) => {
              const castData = JSON.parse(log.data) as {
                text: string;
                author: {
                  fid: number;
                  username: string;
                  display_name: string;
                  pfp_url: string;
                };
              };
              return (
                <div key={log.hash} className={`flex flex-col md:flex-row gap-2 p-2 `}>
                  <p
                    className="text-xs w-[150px] text-gray-400 shrink-0 sm:shrink-1"
                    title={new Date(log.createdAt * 1000).toLocaleString()}
                  >
                    {new Date(log.createdAt * 1000).toLocaleString()}
                  </p>
                  <div className="flex gap-2 w-full items-start">
                    <a className="no-underline" target="_blank" href={`https://warpcast.com/`} rel="noreferrer">
                      <Avatar className="block w-11 h-11">
                        <AvatarImage src={castData.author.pfp_url ?? undefined} alt={"@" + castData.author.username} />
                        <AvatarFallback>{castData.author.username.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                      </Avatar>
                    </a>
                    <div className="flex flex-col w-full">
                      <div className="flex flex-row justify-between items-center">
                        <p className="font-semibold">
                          <a
                            href={`https://warpcast.com/${castData.author.username}`}
                            className="text-gray-500 no-underline hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            @{castData.author.username}
                          </a>
                        </p>
                        {/* <Form method="post">
                          <input type="hidden" name="hash" value={log.hash} />
                          <Button name="intent" value="unhide" variant={"outline"} className="w-full h-full text-left">
                            Unhide
                          </Button>
                        </Form> */}
                      </div>
                      {castData.text && (
                        <Alert className="my-2 text-sm text-gray-500 italic  break-all">{castData.text}</Alert>
                      )}

                      {log.hash && (
                        <p>
                          <a
                            className="text-[8px] no-underline hover:underline uppercase tracking-wide"
                            href={`https://warpcast.com/${castData.author.username}/${log.hash.substring(0, 10)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View on Warpcast
                          </a>
                          <ArrowUpRight className="inline w-2 h-2 mt-[2px] text-primary" />
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
