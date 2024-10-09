import axios from "axios";
import { getSetCache } from "~/lib/utils.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function getPowerBadge() {
  const user = getSetCache({
    key: `powerbadge`,
    get: async () => {
      const response = await axios.get<{ result: { fids: number[] } }>(
        `https://api.neynar.com/v2/farcaster/user/power_lite`,
        {
          headers: {
            api_key: process.env.NEYNAR_API_KEY!,
          },
        }
      );
      return response.data.result.fids;
    },
    ttlSeconds: 60 * 60 * 4,
  });

  return user;
}

async function userHoldsPowerBadge(args: CheckFunctionArgs) {
  const { user } = args;
  const { fid } = user;
  const powerBadge = await getPowerBadge();
  const hasPowerBadge = powerBadge.includes(fid);
  return {
    result: hasPowerBadge,
    message: hasPowerBadge ? "User holds a power badge" : "User does not hold a power badge",
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
    description: "Verify if the user has a power badge, issued to users likely not to be spammers",
    invertedDescription: "Check for users who *do* hold the power badge",
    hidden: false,
    invertable: true,
    args: {},
  },
};
