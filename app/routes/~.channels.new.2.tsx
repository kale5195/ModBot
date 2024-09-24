import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useNavigate } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { requireUser } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { FieldLabel } from "~/components/ui/fields";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { ChannelHeader } from "./~.channels.new.3";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);

  if (!url.searchParams.get("channelId")) {
    throw redirect("/~/new/1");
  }

  const channel = await getWarpcastChannel({ channel: url.searchParams.get("channelId")! });

  return typedjson({
    user,
    channel,
  });
}

export default function Screen() {
  const { channel } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <ChannelHeader channel={channel} />
        <CardTitle>Who can join your channel?</CardTitle>
        <CardDescription>
          All options can be mixed with manual moderation directly in feed.
        </CardDescription>
      </CardHeader>
      <Form
        method="post"
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const moderationMode = formData.get("feed") as string;

          const url = new URL(window.location.href);
          url.searchParams.set("feed", moderationMode);

          navigate({
            pathname: "/~/channels/new/3",
            search: url.search,
          });
        }}
      >
        <CardContent>
          <RadioGroup name="feed" className="space-y-4" defaultValue="recommended">
            <FieldLabel
              label="Recommended"
              labelProps={{ htmlFor: "recommended" }}
              position="right"
              description="People who have a power badge and users you follow."
            >
              <RadioGroupItem className="mt-[2px]" id="recommended" value="recommended" />
            </FieldLabel>

            <FieldLabel
              label="Custom"
              labelProps={{ htmlFor: "custom" }}
              position="right"
              description="Pick and choose from 25+ rules to make the channel feed you want."
            >
              <RadioGroupItem className="mt-[2px]" id="custom" value="custom" />
            </FieldLabel>
          </RadioGroup>
          <p className="text-sm text-gray-500 mt-6">
            You can change this anytime. If you're not sure, start with
            Recommended.
          </p>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto w-full sm:w-[150px]">
            Next
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
