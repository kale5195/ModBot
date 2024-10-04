import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function userFidInList(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { fids } = rule.args as { fids: Array<{ value: number; icon: string; label: string }> };

  const result = fids.some((f) => f.value === user.fid);

  return {
    result,
    message: result ? `@${user.username} is in the list` : `@${user.username} is not in the list`,
  };
}
// Rule: user fid must be in range
function userFidInRange(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { minFid, maxFid } = rule.args as { minFid?: number; maxFid?: number };

  if (minFid) {
    if (user.fid < minFid) {
      return {
        result: true,
        message: `FID #${user.fid} is less than ${minFid}`,
      };
    }
  }

  if (maxFid) {
    if (user.fid > maxFid) {
      return {
        result: true,
        message: `FID #${user.fid} is greater than ${maxFid}`,
      };
    }
  }

  let failureMessage = "";
  if (minFid && maxFid) {
    failureMessage = `FID #${user.fid} is not between ${minFid} and ${maxFid}`;
  } else if (minFid) {
    failureMessage = `FID #${user.fid} is greater than ${minFid}`;
  } else if (maxFid) {
    failureMessage = `FID #${user.fid} is less than ${maxFid}`;
  }

  return {
    result: false,
    message: failureMessage,
  };
}

type RuleName = "userFidInList" | "userFidInRange";

export const userFidRulesDefinitions: Record<RuleName, RuleDefinition> = {
  userFidInList: {
    name: "userFidInList",
    allowMultiple: false,
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    category: "all",
    friendlyName: "User in List",
    checkType: "user",
    description: "Check if the cast author is on a list",
    hidden: false,
    invertable: true,
    args: {
      fids: {
        type: "farcasterUserPickerMulti",
        friendlyName: "Farcaster Usernames",
        required: true,
        placeholder: "Enter a username...",
        description: "",
      },
    },
  },

  userFidInRange: {
    name: "userFidInRange",
    allowMultiple: false,
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    category: "all",
    friendlyName: "User FID",
    checkType: "user",
    description: "Check if the user's FID is less than or greater than a certain value",
    hidden: false,
    invertable: false,
    args: {
      minFid: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "Setting a value of 5 would trigger this rule if the fid is 1 thru 4",
      },
      maxFid: {
        type: "number",
        friendlyName: "More than",
        description: "Setting a value of 10 would trigger this rule if the fid is 11 or above.",
      },
    },
  },
};

export const userFidRulesFunction: Record<RuleName, CheckFunction> = {
  userFidInList,
  userFidInRange,
};
