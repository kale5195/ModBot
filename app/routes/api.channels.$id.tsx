import { json, LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { filterUserRules } from "./api.channels";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const channel = await db.moderatedChannel.findUnique({
    where: {
      id: params.id,
    },
  });

  if (!channel) {
    return json({ error: "Channel not found" }, { status: 404 });
  }

  const {
    id,
    createdAt,
    updatedAt,
    active,
    imageUrl,
    url,
    feedType,
    userId,
    excludeCohosts,
    excludeUsernamesParsed,
    inclusionRuleSetParsed,
    exclusionRuleSetParsed,
  } = channel;

  return json({
    id,
    createdAt,
    updatedAt,
    active,
    imageUrl,
    url,
    feedType,
    userId,
    excludeCohosts,
    excludeUsers: excludeUsernamesParsed,
    membershipRequirements: filterUserRules(inclusionRuleSetParsed?.ruleParsed),
    inclusionRuleSet: inclusionRuleSetParsed?.ruleParsed,
    exclusionRuleSet: exclusionRuleSetParsed?.ruleParsed,
  });
}
