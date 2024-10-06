import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Await, useFetcher } from "@remix-run/react";
import { redirect, typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";

import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { Suspense } from "react";
import axios from "axios";
import { modbotFid } from "./~.channels.$id";
import { Loader } from "lucide-react";
import { FullModeratedChannel } from "~/lib/types";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });
  const dau = getDau();
  const apiKeys = await db.partnerApiKey.findMany({});
  return typeddefer({
    dau,
    apiKeys,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperAdmin({ request });

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "createPartnerApiKey") {
    const name = formData.get("name") as string;
    const expiresInDays = parseInt(formData.get("expiresInDays") as string, 10);

    if (!name || isNaN(expiresInDays)) {
      return errorResponse({ request, message: "Invalid input" });
    }

    const key = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.partnerApiKey.create({
      data: {
        key,
        name,
        expiresAt,
      },
    });

    return successResponse({ request, message: "API key created successfully" });
  } else if (action === "status") {
    const message = (formData.get("message") as string) ?? "";
    const link = (formData.get("link") as string) ?? null;

    await db.status.updateMany({
      where: {
        active: true,
      },
      data: {
        active: false,
      },
    });

    await db.status.create({
      data: {
        message,
        link,
        active: true,
        type: "warning",
      },
    });

    return successResponse({ request, message: "Status updated" });
  }

  return typedjson({ message: "Invalid action" }, { status: 400 });
}

export default function Admin() {
  const { dau, apiKeys } = useTypedLoaderData<typeof loader>();
  const apiKeysFetcher = useFetcher<typeof loader>();

  return (
    <div className="flex flex-col sm:flex-row gap-8 w-full">
      <div className="w-full">
        <h3>Admin</h3>
        <div className="space-y-20">
          <div>
            <h3>API Keys</h3>
            <apiKeysFetcher.Form method="post" className="space-y-4">
              <FieldLabel label="Label" className="flex-col items-start">
                <Input name="name" placeholder="API Key Name" required />
              </FieldLabel>
              <FieldLabel label="Expires In (days)" className="flex-col items-start">
                <Input type="number" name="expiresInDays" placeholder="Expires in (days)" required />
              </FieldLabel>
              <Button name="action" value="createPartnerApiKey" type="submit">
                Create
              </Button>
            </apiKeysFetcher.Form>
            {apiKeys.length > 0 && (
              <ul className="mt-4 text-sm">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="flex justify-between">
                    <p>
                      {apiKey.name} (until {apiKey.expiresAt.toLocaleDateString()})
                    </p>
                    <Button size={"xs"} variant={"ghost"} onClick={() => prompt("API Key", apiKey.key)}>
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-20 min-w-[300px] text-sm">
        <Suspense
          fallback={
            <div className="flex justify-center h-full w-full">
              <Loader className="animate-spin w-5 h-5" />
            </div>
          }
        >
          <Await resolve={dau}>
            {(_dau) => {
              return (
                <>
                  <div className="flex flex-col gap-2">
                    <h3>Account Breakdown</h3>
                    {_dau.usersByPlan.map((u) => (
                      <div key={u.plan} className="flex justify-between items-center">
                        <p>{u.plan}</p>
                        <p>{u._count._all}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3>Active Channels - {_dau.active.length.toLocaleString()}</h3>
                    {_dau.active
                      .sort((a, b) => b.memberCount - a.memberCount)
                      .map((c) => (
                        <ChannelStat key={c.id} c={c} />
                      ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2>Setup Incomplete - {_dau.setupIncomplete.length.toLocaleString()}</h2>
                    {_dau.setupIncomplete
                      .sort((a, b) => b.memberCount - a.memberCount)
                      .map((c) => (
                        <ChannelStat key={c.id} c={c} />
                      ))}
                  </div>
                </>
              );
            }}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

function ChannelStat({ c }: { c: { id: string; memberCount: number } }) {
  return (
    <div className="flex gap-2 justify-between">
      <div className="w-full">
        <a target="_blank" href={`https://warpcast.com/~/channel/${c.id}`} rel="noreferrer">
          /{c.id}
        </a>
      </div>
      <div className="font-mono">{c.memberCount.toLocaleString()}</div>
    </div>
  );
}

export function hasNoRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length === 0;
}

export function hasRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length !== 0;
}

export async function getDau() {
  const rsp = await axios.get(`https://api.warpcast.com/v2/all-channels`);
  const channels = rsp.data.result.channels;
  const moderatedChannels = await db.moderatedChannel.findMany({
    select: {
      id: true,
    },
  });

  const active = [];
  const setupIncomplete = [];

  for (const channel of channels) {
    if (channel.moderatorFids?.includes(modbotFid)) {
      active.push(channel);
    } else {
      if (moderatedChannels.find((mc) => mc.id.toLowerCase() === channel.id.toLowerCase())) {
        setupIncomplete.push(channel);
      }
    }
  }

  const usersByPlan = await db.user.groupBy({
    by: ["plan"],
    _count: {
      _all: true,
    },
  });

  const newSignups = await db.user.findMany({
    where: {
      createdAt: {
        gte: new Date(new Date().getTime() - 1000 * 60 * 60 * 72),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const newChannels = await db.moderatedChannel.findMany({
    where: {
      createdAt: {
        gte: new Date(new Date().getTime() - 1000 * 60 * 60 * 72),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    active,
    setupIncomplete,
    usersByPlan,
    newChannels,
    newSignups,
  };
}
