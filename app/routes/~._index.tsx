import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { commitSession, getSession } from "~/lib/auth.server";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { Link } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const env = getSharedEnv();

  const [frames, session] = await Promise.all([
    db.frame.findMany({
      where: {
        userId: user.id,
      },
    }),
    getSession(request.headers.get("Cookie")),
  ]);

  return typedjson(
    {
      user,
      frames,
      hostUrl: env.hostUrl,
      newlyCreatedUrl: session.get("newFrame") ?? null,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function FrameConfig() {
  const { frames, newlyCreatedUrl } = useTypedLoaderData<typeof loader>();
  const { copy, copied } = useClipboard();

  return (
    <div>
      <Dialog defaultOpen={!!newlyCreatedUrl}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>Your frame has been created.</DialogDescription>
            <div className="flex items-center justify-center gap-2 py-4">
              <Input value={newlyCreatedUrl} />
              <Button onClick={() => copy(newlyCreatedUrl)}>
                {copied ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <CopyIcon className="w-5 h-5" />
                )}
              </Button>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      {!frames.length && (
        <div>
          <h1>No frames yet.</h1>
          <Link to="/~/frames/new">Create a new frame</Link>
        </div>
      )}
      {frames.map((frame) => (
        <div key={frame.id} className="flex items-center justify-between">
          <h2>{frame.slug}</h2>
          <div className="flex items-center gap-2">
            <Button asChild variant={"ghost"}>
              <Link className="no-underline" to={`/${frame.slug}/edit`}>
                Edit
              </Link>
            </Button>
            <Button className="w-[150px]" variant={"secondary"}>
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}