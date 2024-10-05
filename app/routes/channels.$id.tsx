/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import invariant from "tiny-invariant";
import { actionDefinitions, getRuleDefinitions } from "~/lib/validations.server";
import { Rule, ruleNames } from "~/rules/rules.type";
import { RuleDisplayForm } from "~/components/rule-display-form";
import { RuleSet } from "~/lib/types";
import { ArrowLeft } from "lucide-react";
import { Link } from "@remix-run/react";
import { Card, CardHeader, CardContent } from "~/components/ui/card";

export const meta: MetaFunction<typeof loader> = (data) => {
  return [
    {
      title: `/${data.data.channel.id} channel Rules | ModBot`,
    },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  const channelId = params.id;
  const url = new URL(request.url);
  const fid = url.searchParams.get("fid");
  let log = null;
  if (fid) {
    log = await db.moderationLog.findFirst({
      select: {
        affectedUserFid: true,
        affectedUserAvatarUrl: true,
        affectedUsername: true,
        reason: true,
        action: true,
      },
      where: {
        channelId,
        affectedUserFid: fid,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
  const channel = await db.moderatedChannel.findUniqueOrThrow({
    where: {
      id: channelId,
    },
    include: {
      user: true,
      roles: {
        include: {
          delegates: true,
        },
      },
      comods: true,
    },
  });
  return typedjson({
    log,
    channel,
    actionDefinitions,
    ruleDefinitions: getRuleDefinitions("0", channel.id),
    ruleNames,
  });
}

export default function Channels() {
  const { channel, ruleDefinitions, ruleNames, log } = useTypedLoaderData<typeof loader>();

  return (
    <section className="space-y-4 w-full">
      <Link
        className="text-[9px] tracking-wider text-gray-500 no-underline items-center flex gap-1 mb-1"
        to={"/channels"}
      >
        <ArrowLeft className="inline w-3 h-3" />
        <p>BACK</p>
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={channel.imageUrl || ""} className="w-10 h-10 rounded-full" />
          <a
            href={`https://warpcast.com/~/channel/${channel.id}`}
            className="no-underline"
            target="_blank"
            rel="noreferrer"
          >
            <h1 style={{ fontFamily: "Kode Mono" }}>/{channel.id}</h1>
          </a>
        </div>
      </div>

      <div className="py-4">
        <hr />
      </div>
      {log && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <img src={log.affectedUserAvatarUrl || ""} className="w-10 h-10 rounded-full" />
              <p className="font-medium text-lg">
                {log.affectedUsername} was {log.action === "like" ? "invited (✅)" : "not invited (❌)"}
              </p>
            </div>
          </CardHeader>
          <CardContent>{log.reason}</CardContent>
        </Card>
      )}
      <RuleDisplayForm
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ...channel,
          excludeUsernames: channel.excludeUsernamesParsed,
          exclusionRuleSet: patchNewRuleSet(false, channel.exclusionRuleSetParsed!),
          inclusionRuleSet: patchNewRuleSet(true, channel.inclusionRuleSetParsed!),
        }}
      />
    </section>
  );
}
function patchNewRuleSet(
  inclusion: boolean,
  ruleSet: RuleSet & {
    ruleParsed: Rule;
    actionsParsed: any;
  }
) {
  return {
    id: ruleSet?.id,
    target: ruleSet?.target || "all",
    active: ruleSet?.active || true,
    ruleParsed: ruleSet?.ruleParsed?.conditions || [],
    actionsParsed: ruleSet?.actionsParsed?.length
      ? ruleSet.actionsParsed
      : inclusion
      ? [{ type: "like" }]
      : [{ type: "hideQuietly" }],
    logicType: ruleSet?.ruleParsed?.operation || ("OR" as const),
  };
}
