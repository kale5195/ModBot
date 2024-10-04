import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function userHoldsPowerBadge(args: CheckFunctionArgs) {
  const { user } = args;

  return {
    result: user.power_badge,
    message: user.power_badge ? "User holds a power badge" : "User does not hold a power badge",
  };
}

type RuleName = "userDoesNotHoldPowerBadge";
export const powerbadgeRulesFunction: Record<RuleName, CheckFunction> = {
  userDoesNotHoldPowerBadge: userHoldsPowerBadge,
};

export const powerbadgeRulesDefinitions: Record<RuleName, RuleDefinition> = {
  userDoesNotHoldPowerBadge: {
    name: "userDoesNotHoldPowerBadge",
    author: "neynar",
    authorUrl: "https://neynar.com/",
    authorIcon: `/icons/neynar.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "Power Badge",
    checkType: "user",
    description: "Check if the user holds a power badge",
    invertedDescription: "Check for users who *do* hold the power badge",
    hidden: false,
    invertable: true,
    args: {},
  },
};
