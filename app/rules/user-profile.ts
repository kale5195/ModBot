import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

function userProfileContainsText(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { searchText, caseSensitive } = rule.args;
  const containsText = !caseSensitive
    ? user.profile.bio.text?.toLowerCase().includes(searchText.toLowerCase())
    : user.profile.bio.text?.includes(searchText);

  return {
    result: containsText,
    message: containsText ? `Profile contains "${searchText}"` : `Profile does not contain "${searchText}"`,
  };
}

function userFollowerCount(props: CheckFunctionArgs) {
  const { user, rule } = props;
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (user.follower_count < min) {
      return {
        result: true,
        message: `User has less than ${min} followers`,
      };
    }
  }

  if (max) {
    if (user.follower_count > max) {
      return {
        result: true,
        message: `User has more than ${max} followers`,
      };
    }
  }

  return {
    result: false,
    message: "User follower count is within limits",
  };
}

function userDisplayNameContainsText(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { searchText, caseSensitive } = rule.args;

  if (!user.display_name) {
    // Sentry.captureMessage(`Cast author has no display name: ${user.fid}`, {
    //   extra: {
    //     user,
    //   },
    // });

    return {
      result: false,
      message: "User has no display name",
    };
  }

  const containsText = !caseSensitive
    ? user.display_name.toLowerCase().includes(searchText.toLowerCase())
    : user.display_name.includes(searchText);

  return {
    result: containsText,
    message: containsText ? `Display name contains "${searchText}"` : `Display name does not contain "${searchText}"`,
  };
}

type RuleName = "userProfileContainsText" | "userDisplayNameContainsText" | "userFollowerCount";

export const userProfileRulesDefinitions: Record<RuleName, RuleDefinition> = {
  userProfileContainsText: {
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    name: "userProfileContainsText",
    allowMultiple: true,
    category: "all",
    friendlyName: "Profile Contains Text",
    checkType: "user",
    description: "Check if the user's profile contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked, 'abc' is different from 'ABC'",
      },
    },
  },
  userDisplayNameContainsText: {
    name: "userDisplayNameContainsText",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "User Display Name Contains Text",
    checkType: "user",
    description: "Check if the user's display name contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        required: true,
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked 'abc' is different from 'ABC'",
      },
    },
  },
  userFollowerCount: {
    name: "userFollowerCount",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "User Follower Count",
    checkType: "user",
    hidden: false,
    invertable: false,
    description: "Check if the user's follower count is within a range",
    args: {
      min: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "If you enter 10, the rule will trigger if the user has less than 10 followers.",
      },
      max: {
        type: "number",
        friendlyName: "More than",
        placeholder: "No Maximum",
        description: "If you enter 50, the rule will trigger if the user has more than 50 followers.",
      },
    },
  },
};

export const userProfileRulesFunction: Record<RuleName, CheckFunction> = {
  userProfileContainsText,
  userDisplayNameContainsText,
  userFollowerCount,
};
