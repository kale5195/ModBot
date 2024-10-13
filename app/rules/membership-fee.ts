import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";
import { db } from "~/lib/db.server";

export async function membershipFeeRequired(args: CheckFunctionArgs) {
  const { user, rule, channel } = args;
  const { tokenName, feeAmount, receiveAddress } = rule.args;

  const channelOrder = await db.channelOrder.findFirst({
    where: {
      channelId: channel.id,
      fid: user.fid.toString(),
      address: receiveAddress,
      status: 1,
    },
  });

  const isPaid = !!channelOrder;
  return {
    result: isPaid,
    message: isPaid
      ? `User has paid the membership fee to join the channel`
      : `Membership fee required: ${feeAmount} ${tokenName}`,
  };
}

type RuleName = "membershipFeeRequired";

export const membershipFeeRulesDefinitions: Record<RuleName, RuleDefinition> = {
  membershipFeeRequired: {
    name: "membershipFeeRequired",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: " Membership Fee Required",
    checkType: "user",
    description: "Require the user pay a membership fee to join the channel",
    invertedDescription: "Check for users who *do not* pay a membership fee to join the channel",
    hidden: false,
    invertable: true,
    args: {
      tokenName: {
        type: "select",
        friendlyName: "Token Name",
        description: "",
        required: true,
        defaultValue: "8453",
        options: [{ value: "ETH (Base Chain)", label: "ETH (Base Chain)" }],
      },
      feeAmount: {
        type: "string",
        required: true,
        friendlyName: "Fee Amount",
        placeholder: "0.01",
        description: "",
      },
      receiveAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Address to receive fees",
        description: "",
      },
    },
  },
};

export const membershipFeeRulesFunction: Record<RuleName, CheckFunction> = {
  membershipFeeRequired: membershipFeeRequired,
};
