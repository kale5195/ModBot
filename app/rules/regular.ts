import { db } from "~/lib/db.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function manuallyApprove(args: CheckFunctionArgs) {
  // remove existing moderation logs
  const { channel, user } = args;
  await db.moderationLog.deleteMany({
    where: {
      channelId: channel.id,
      affectedUserFid: user.fid.toString(),
    },
  });
  return {
    result: false,
    message: "Need manual approval by channel moderators",
  };
}

function and(args: CheckFunctionArgs) {
  return { result: true, message: "And rule always passes" };
}

function or(args: CheckFunctionArgs) {
  return { result: true, message: "Or rule always passes" };
}

function alwaysInclude(args: CheckFunctionArgs) {
  return { result: true, message: "Everything included by default" };
}

type RuleName = "manuallyApprove" | "and" | "or" | "alwaysInclude";
export const regularRulesFunction: Record<RuleName, CheckFunction> = {
  manuallyApprove,
  and,
  or,
  alwaysInclude,
};

export const regularRulesDefinitions: Record<RuleName, RuleDefinition> = {
  and: {
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    name: "and",
    category: "all",
    friendlyName: "And",
    checkType: "cast",
    description: "Combine multiple rules together",
    hidden: true,
    invertable: false,
    args: {},
  },

  or: {
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    name: "or",
    category: "all",
    friendlyName: "Or",
    checkType: "cast",
    hidden: true,
    invertable: false,
    description: "Combine multiple rules together",
    args: {},
  },

  alwaysInclude: {
    name: "alwaysInclude",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "inclusion",
    friendlyName: "Anyone Can Join",
    checkType: "cast",
    description: "Anyone can join your channel.",
    hidden: false,
    invertable: false,
    args: {},
  },
  manuallyApprove: {
    name: "manuallyApprove",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "inclusion",
    friendlyName: " Manually Approve",
    checkType: "cast",
    description: "Manually approve member requests in Activity tab",
    hidden: false,
    invertable: false,
    args: {},
  },
};
