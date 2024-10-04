import axios from "axios";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";
type BotOrNotResponse = { fid: number; result: { bot?: boolean; status: "complete" | "analyzing" } };

async function isHuman(args: CheckFunctionArgs) {
  const { user } = args;
  const rsp = await axios.get<BotOrNotResponse>(
    `https://cast-action-bot-or-not.vercel.app/api/botornot/mod/v1?fid=${user.fid}&forceAnalyzeIfEmpty=true`,
    {
      timeout: 5_000,
      timeoutErrorMessage: "Bot or Not API timed out",
    }
  );

  const isBot = rsp.data.result.bot;

  if (isBot === undefined) {
    // retry later
    throw new Error(`Bot or not status for fid #${rsp.data.fid}: ${rsp.data.result.status}`);
  }

  return {
    result: !isBot,
    message: isBot ? "Bot detected by Bot Or Not" : "Human detected by Bot Or Not",
  };
}

type RuleName = "isHuman";
export const botOrNotRulesFunction: Record<RuleName, CheckFunction> = {
  isHuman: isHuman,
};

export const botOrNotRulesDefinitions: Record<RuleName, RuleDefinition> = {
  isHuman: {
    name: "isHuman",
    author: "botornot",
    authorUrl: "https://warpcast.com/botornot",
    authorIcon: `/icons/botornot.png`,
    allowMultiple: false,
    checkType: "user",
    category: "all",
    friendlyName: "Proof of Human, by Bot or Not",
    description: "Check if the cast author is a human using Bot Or Not",
    hidden: false,
    fidGated: [5179],
    invertable: false,
    args: {},
  },
};
