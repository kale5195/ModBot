import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { typedjson, useTypedFetcher, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Form } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getChannel, neynar, pageChannelCasts } from "~/lib/neynar.server";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { Loader2 } from "lucide-react";
import { ModerationLog } from "@prisma/client";
import { FullModeratedChannel, WebhookCast } from "~/lib/types";
import { Input } from "~/components/ui/input";
import { FieldLabel } from "~/components/ui/fields";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Alert } from "~/components/ui/alert";
import { ActionType, actionDefinitions } from "~/lib/validations.server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { validateCast } from "~/lib/automod.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  // only channels that have a signer can sweep as far back
  // as they want, because otherwise you can burn through
  const channelsWithSigners = await db.signerAllocation.findMany({
    select: {
      channelId: true,
    },
  });
  const allowSweepTimeRange = channelsWithSigners.map((signer) => signer.channelId);

  return typedjson({
    user,
    moderatedChannel,
    actionDefinitions,
    allowSweepTimeRange,
    env: getSharedEnv(),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const session = await getSession(request.headers.get("Cookie"));

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      intent: z.enum(["sweep", "testCast"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  if (result.data.intent === "testCast") {
    const fidOrUsername = rawData.fidOrUsername as string;
    if (!fidOrUsername) {
      return errorResponse({
        request,
        message: "Fid or username is required",
      });
    }

    const userRes = await neynar.fetchBulkUsers([Number(fidOrUsername)]);
    const user = userRes.users[0];
    const logs = await validateCast({
      user,
      moderatedChannel,
      simulation: true,
    });
    // console.log("logs", logs);
    return typedjson({
      logs,
    });
  } else {
    return errorResponse({
      request,
      message: "Invalid intent",
    });
  }
}

export default function Screen() {
  const { actionDefinitions } = useTypedLoaderData<typeof loader>();

  return (
    <main className="space-y-6">
      <div>
        <p className="font-semibold">Tools</p>
      </div>

      <hr />

      <div className="space-y-3">
        <div>
          <p className="font-medium">Simulate Rules</p>
          <p className="text-sm text-gray-500">Enter a fid to simulate your moderation rules.</p>
        </div>
      </div>
      <SimulateCast actionDefs={actionDefinitions} />
    </main>
  );
}

function SimulateCast(props: { actionDefs: typeof actionDefinitions }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [open, setIsOpen] = useState(false);
  const [fetcherKey, setFetcherKey] = useState(new Date().toString());
  const fetcher = useTypedFetcher<typeof action>({
    key: fetcherKey,
  });
  const busy = fetcher.state === "submitting";
  const data = fetcher.data as unknown as { logs: ModerationLog[] } | { message: string } | undefined;
  const logData = data && "logs" in data;

  return (
    <fetcher.Form
      method="post"
      onSubmit={() => {
        setIsOpen(true);
      }}
      className="space-y-4"
    >
      <FieldLabel label="Fid" className="items-start flex-col">
        <Input name="fidOrUsername" placeholder="Enter Fid" />
      </FieldLabel>

      <Button
        className="w-full sm:w-auto min-w-[150px]"
        name="intent"
        disabled={busy}
        value="testCast"
        variant={"secondary"}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin inline w-4 h-4 mr-2" />
            Simulating...
          </>
        ) : (
          "Simulate"
        )}
      </Button>
      <Dialog
        open={!!logData}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setFetcherKey(new Date().toString());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulation Result</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          {(() => {
            if (!data) {
              return <Loader2 className="animate-spin inline w-4 h-4 mr-2" />;
            }

            if ("message" in data) {
              return <Alert variant={"default"}>{data.message as unknown as string}</Alert>;
            }

            if ("logs" in data && data.logs.length === 0) {
              return <Alert variant={"default"}>Cast does not violate any rules.</Alert>;
            }

            if ("logs" in data && data.logs.length > 0) {
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Action</TableHead>
                      <TableHead className="w-[50px]">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{props.actionDefs[log.action as ActionType].friendlyName}</TableCell>
                        <TableCell>{log.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
    </fetcher.Form>
  );
}

export type SweepArgs = {
  channelId: string;
  moderatedChannel: FullModeratedChannel;
  limit: number;
  untilTimeUtc?: string;
  untilCastHash?: string;
  skipSignerCheck?: boolean;
  onProcessed?: () => void;
};

export async function sweep(args: SweepArgs) {}

export type SimulateArgs = {
  channelId: string;
  moderatedChannel: FullModeratedChannel | null;
  proposedModeratedChannel: FullModeratedChannel;
  limit: number;
  onProgress?: (castsProcessed: number) => Promise<void>;
};

export type SimulationResult = Array<{
  hash: string;
  existing: ModerationLog[];
  proposed: ModerationLog[];
}>;

export async function simulate(args: SimulateArgs) {
  // const aggregatedResults: SimulationResult = [];
  // let castsChecked = 0;
  // for await (const page of pageChannelCasts({ id: args.channelId })) {
  //   if (castsChecked >= args.limit) {
  //     console.log(
  //       `${args.channelId} sweep: reached limit of ${args.limit} casts checked, stopping simulation`
  //     );
  //     break;
  //   }
  //   castsChecked += page.casts.length;
  //   for (const cast of page.casts) {
  //     console.log(`${args.channelId} sweep: processing cast ${cast.hash}...`);
  //     const [existing, proposed] = await Promise.all([
  //       args.moderatedChannel
  //         ? validateCast({
  //             // neynars typings are wrong, casts include root_parent_urls
  //             cast: cast as unknown as WebhookCast,
  //             moderatedChannel: args.moderatedChannel,
  //             simulation: true,
  //           })
  //         : Promise.resolve([]),
  //       validateCast({
  //         // neynars typings are wrong
  //         cast: cast as unknown as WebhookCast,
  //         moderatedChannel: args.proposedModeratedChannel,
  //         simulation: true,
  //       }),
  //     ]);
  //     aggregatedResults.push({
  //       hash: cast.hash,
  //       existing,
  //       proposed,
  //     });
  //     await args.onProgress?.(castsChecked);
  //     await sleep(500);
  //   }
  // }
  // return aggregatedResults;
}
