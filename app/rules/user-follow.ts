import { neynar } from "~/lib/neynar.server";
import { isFollowingChannel } from "~/lib/warpcast.server";

import { CheckFunction, CheckFunctionArgs, RuleDefinition, SelectOption } from "~/rules/rules.type";

export async function userFollowsChannel(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { channelSlug } = rule.args;

  const follows = await isFollowingChannel({ channel: channelSlug, fid: user.fid });

  return {
    result: follows,
    message: follows ? `User follows /${channelSlug}` : `User does not follow /${channelSlug}`,
  };
}

export async function userFollowedBy(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { users } = rule.args as { users: SelectOption[] };

  if (users.some((u) => u.value === user.fid)) {
    return {
      result: true,
      message: "User implicitly followed by themselves",
    };
  }

  const followingStatus = await neynar
    .fetchBulkUsers(
      users.map((u) => u.value),
      {
        viewerFid: user.fid,
      }
    )
    .then((rsp) => rsp.users);

  const isFollowing = followingStatus.find((f) => f.viewer_context?.followed_by);

  return {
    result: !!isFollowing,
    message: isFollowing
      ? `@${user.username} is followed by @${isFollowing.username}`
      : `@${user.username} is not followed by ${
          users.length > 1 ? `any of ${users.map((u) => `@${u.label}`).join(", ")}` : `@${users[0].label}`
        }`,
  };
}

export async function userFollows(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { users } = rule.args as { users: SelectOption[] };

  if (users.some((u) => u.value === user.fid)) {
    return {
      result: true,
      message: "User implicitly follow themselves",
    };
  }

  const followingStatus = await neynar
    .fetchBulkUsers(
      users.map((u) => u.value),
      {
        viewerFid: user.fid,
      }
    )
    .catch((err) => {
      console.error(err);
      return Promise.reject(err);
    })
    .then((rsp) => rsp.users);

  const isFollowing = followingStatus.find((f) => f.viewer_context?.following);
  return {
    result: !!isFollowing,
    message: isFollowing
      ? `@${user.username} follows @${isFollowing.username}`
      : `@${user.username} does not follow ${
          users.length > 1 ? `any of ${users.map((u) => `@${u.label}`).join(", ")}` : `@${users[0].label}`
        }`,
  };
}

type RuleName = "userDoesNotFollow" | "userIsNotFollowedBy";
export const userFollowRulesFunction: Record<RuleName, CheckFunction> = {
  userDoesNotFollow: userFollows,
  userIsNotFollowedBy: userFollowedBy,
};

export const userFollowRulesDefinitions: Record<RuleName, RuleDefinition> = {
  // userFollowsChannel: {
  //   name: "userFollowsChannel",
  //   author: "modbot",
  //   authorUrl: "https://modbot.sh",
  //   authorIcon: `/icons/modbot.png`,
  //   allowMultiple: true,
  //   category: "all",
  //   friendlyName: "Follows Channel",
  //   checkType: "user",
  //   hidden: false,
  //   invertable: false,
  //   description: "Check if the user follows a channel",
  //   args: {
  //     channelSlug: {
  //       type: "string",
  //       friendlyName: "Channel ID",
  //       placeholder: "dont-do-this",
  //       required: true,
  //       pattern: "/^[a-zA-Z0-9-]+$/",
  //       description: "The id of the channel to check",
  //     },
  //   },
  // },
  userDoesNotFollow: {
    name: "userDoesNotFollow",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Following",
    checkType: "user",
    description: "Check if the user follows certain accounts",
    hidden: false,
    invertable: false,
    args: {
      users: {
        type: "farcasterUserPickerMulti",
        required: true,
        friendlyName: "Farcaster Usernames",
        placeholder: "Enter a username...",
        description:
          "Example: If you enter jtgi and riotgoools, it will check that the user follows either jtgi or riotgools.",
      },
    },
  },

  userIsNotFollowedBy: {
    name: "userIsNotFollowedBy",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Followed By",
    checkType: "user",
    description: "Check if the user is followed by certain accounts",
    hidden: false,
    invertable: true,
    args: {
      users: {
        type: "farcasterUserPickerMulti",
        required: true,
        friendlyName: "Usernames",
        placeholder: "Enter a username...",
        description:
          "Example: If you enter jtgi and riotgoools, it will check that either jtgi or riotgools follow the user requesting an invite.",
      },
    },
  },
};
