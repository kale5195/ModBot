import { holdingFanTokenBalance } from "~/lib/airstack.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function holdsChannelFanToken(args: CheckFunctionArgs) {
  const { user, rule, channel } = args;
  const { contractAddress, minBalance, symbol } = rule.args;
  const balance = await holdingFanTokenBalance({ fid: user.fid, symbol });
  const hasEnough = balance >= minBalance;

  return {
    result: hasEnough,
    message: hasEnough ? `Holds /${channel.id} Fan Token` : `Does not hold enough /${channel.id} Fan Token`,
  };
}

async function holdsFanToken(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const {
    minBalance,
    fanToken: { value: contractAddress, label, symbol },
  } = rule.args;

  const balance = await holdingFanTokenBalance({ fid: user.fid, symbol });
  const hasEnough = balance >= minBalance;
  return {
    result: hasEnough,
    message: hasEnough ? `User holds @${label}'s Fan Token` : `User does not hold enough of @${label}'s Fan Token`,
  };
}

type RuleName = "holdsChannelFanToken" | "holdsFanToken";

export const fantokenRulesFunction: Record<RuleName, CheckFunction> = {
  holdsChannelFanToken: holdsChannelFanToken,
  holdsFanToken: holdsFanToken,
};

export const fantokenRulesDefinitions: Record<RuleName, RuleDefinition> = {
  holdsFanToken: {
    name: "holdsFanToken",
    author: "Moxie",
    authorUrl: "https://moxie.xyz",
    authorIcon: `/icons/moxie.png`,
    allowMultiple: true,
    category: "inclusion",
    friendlyName: "Moxie Fan Token",
    checkType: "user",
    description: "Check if the cast author holds a Moxie fan token",
    hidden: false,
    invertable: false,
    args: {
      fanToken: {
        type: "moxieMemberFanTokenPicker",
        required: true,
        friendlyName: "Fan Token",
        placeholder: "Enter a username...",
        description: "If you don't see the token you're looking for, it may not be available yet. Check airstack.xyz",
      },
      minBalance: {
        type: "string",
        required: false,
        placeholder: "Any Amount",
        pattern: "^[0-9]+(\\.[0-9]+)?$",
        friendlyName: "Minimum Balance",
        description: "The minimum amount of fan tokens the user must hold.",
      },
    },
  },

  holdsChannelFanToken: {
    name: "holdsChannelFanToken",
    author: "Moxie",
    authorUrl: "https://moxie.xyz",
    authorIcon: `/icons/moxie.png`,
    allowMultiple: false,
    category: "inclusion",
    friendlyName: "Moxie Channel Fan Token",
    checkType: "cast",
    description: "Check if the cast author holds the fan token for your channel",
    hidden: false,
    invertable: false,
    args: {
      minBalance: {
        type: "string",
        required: false,
        placeholder: "Any Amount",
        friendlyName: "Minimum Balance",
        pattern: "^[0-9]+(\\.[0-9]+)?$",
        description: "The minimum amount of fan tokens the user must hold.",
      },
    },
  },
};
