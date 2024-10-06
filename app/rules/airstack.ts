import { farRank } from "~/lib/airstack.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function airstackSocialCapitalRank(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { minRank } = rule.args as { minRank: number };

  const rank = await farRank({ fid: user.fid }).then((res) => (res === null ? Infinity : res));

  if (rank === Infinity) {
    console.error(`User's FarRank is not available: ${user.fid}`);
    return {
      result: false,
      message: "User's social FarRank is not available",
    };
  }

  return {
    result: rank <= minRank,
    message:
      rank <= minRank
        ? `User FarRank is #${rank.toLocaleString()}, higher than #${minRank.toLocaleString()}`
        : `User's FarRank is #${rank.toLocaleString()}, lower than #${minRank.toLocaleString()}`,
  };
}

type RuleName = "airstackSocialCapitalRank";
export const airstackRulesFunction: Record<RuleName, CheckFunction> = {
  airstackSocialCapitalRank,
};

export const airstackRulesDefinitions: Record<RuleName, RuleDefinition> = {
  airstackSocialCapitalRank: {
    name: "airstackSocialCapitalRank",
    author: "Airstack",
    authorUrl: "https://airstack.xyz",
    authorIcon: `/icons/airstack.png`,
    allowMultiple: false,
    hidden: false,
    category: "all",
    friendlyName: "FarRank by Airstack",
    checkType: "user",
    description: "Check if the user's Airstack FarRank is high enough.",
    invertable: false,
    args: {
      minRank: {
        type: "number",
        friendlyName: "Minimum Rank",
        required: true,
        placeholder: "e.g. 100",
        description: "Example: if you enter 100, the rule will check that the user's FarRank is 1 to 100.",
      },
    },
  },
};
