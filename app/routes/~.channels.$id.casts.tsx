/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { actionDefinitions, getRuleDefinitions } from "~/lib/validations.server";
import { ruleNames } from "~/rules/rules.type";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { v4 as uuid } from "uuid";
import { addToBypassAction } from "~/lib/cast-actions.server";
import { actionToInstallLink } from "~/lib/utils";
import { CastCurationForm } from "~/components/cast-curation-form";
import { z } from "zod";
import { toggleWebhook } from "~/routes/api.channels.$id.toggleEnable";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const modChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const data = await request.json();

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(data, null, 2));
  }

  const ch = await z
    .object({
      id: z.string().transform((id) => id.toLowerCase()),
      slowModeHours: z.coerce.number().default(0),
      excludeUsernames: z
        .array(z.object({ value: z.number(), label: z.string(), icon: z.string().optional() }))
        .default([]),
    })
    .safeParseAsync(data);

  if (!ch.success) {
    console.error(JSON.stringify(ch.error, null, 2));
    return errorResponse({
      request,
      message: formatZodError(ch.error),
    });
  }

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(ch.data, null, 2));
  }

  const [updatedChannel, session] = await Promise.all([
    db.moderatedChannel.update({
      where: {
        id: modChannel.id,
      },
      include: {
        user: true,
      },
      data: {
        slowModeHours: ch.data.slowModeHours,
        excludeUsernames: JSON.stringify(ch.data.excludeUsernames),
      },
    }),
    getSession(request.headers.get("Cookie")),
  ]);
  if (ch.data.slowModeHours !== modChannel.slowModeHours) {
    console.log("toggling webhook", ch.data.slowModeHours);
    toggleWebhook({ channelId: modChannel.id, active: ch.data.slowModeHours > 0 }).catch(console.error);
  }
  session.flash("message", {
    id: uuid(),
    type: "success",
    message: "Channel updated!",
  });

  return redirect(`/~/channels/${updatedChannel.id}/casts`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const [channel, cohostRole] = await Promise.all([
    requireUserCanModerateChannel({
      userId: user.id,
      channelId: params.id,
    }),
    db.role.findFirst({
      where: {
        channelId: params.id,
        isCohostRole: true,
      },
    }),
  ]);

  return typedjson({
    user,
    channel,
    actionDefinitions,
    ruleDefinitions: getRuleDefinitions(user.id, channel.id),
    ruleNames,
    cohostRole,
    bypassInstallLink: actionToInstallLink(addToBypassAction),
    env: getSharedEnv(),
  });
}

export default function Screen() {
  const { user, channel, ruleNames, ruleDefinitions, actionDefinitions, cohostRole, bypassInstallLink } =
    useTypedLoaderData<typeof loader>();

  return (
    <div className="w-full">
      <div className="">
        <p className="font-semibold">Cast Rules</p>
        <p className="text-gray-500">The following settings control how casts appear in channel feeds.</p>
      </div>

      <CastCurationForm
        user={user}
        bypassInstallLink={bypassInstallLink}
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        cohostRole={cohostRole}
        defaultValues={{
          ...channel,
          excludeUsernames: channel.excludeUsernamesParsed,
        }}
      />
    </div>
  );
}
