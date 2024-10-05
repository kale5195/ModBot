import { isChannelMember } from "~/lib/warpcast.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function userIsMemberOfChannel(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { channelSlug } = rule.args;

  const isMember = await isChannelMember({ channel: channelSlug, fid: user.fid });
  return {
    result: isMember,
    message: isMember ? `User is member of /${channelSlug}` : `User is not member of /${channelSlug}`,
  };
}

type RuleName = "userIsChannelMember";
export const channelMemberRulesFunction: Record<RuleName, CheckFunction> = {
  userIsChannelMember: userIsMemberOfChannel,
};

export const channelMemberRulesDefinitions: Record<RuleName, RuleDefinition> = {
  userIsChannelMember: {
    name: "userIsChannelMember",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Channel Member",
    checkType: "user",
    hidden: false,
    invertable: false,
    description: "Check if the user is a member of a channel",
    args: {
      channelSlug: {
        type: "string",
        friendlyName: "Channel ID",
        placeholder: "replyguys",
        required: true,
        pattern: "/^[a-zA-Z0-9-]+$/",
        description: "The id of the channel to check",
      },
    },
  },
};
