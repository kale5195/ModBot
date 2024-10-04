import { checkSubscribesOnParagraph } from "~/lib/neynar.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function subscribesOnParagraph(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { farcasterUser } = rule.args as { farcasterUser: { value: number; label: string; icon: string } };
  const isSubbed = await checkSubscribesOnParagraph({ fid: user.fid, value: farcasterUser.value });

  return {
    result: isSubbed,
    message: isSubbed
      ? `User is subscribed to @${farcasterUser.label} on Paragraph `
      : `User is not subscribed to @${farcasterUser.label} on Paragraph`,
  };
}

type RuleName = "subscribesOnParagraph";
export const paragraphRulesFunction: Record<RuleName, CheckFunction> = {
  subscribesOnParagraph,
};

export const paragraphRulesDefinitions: Record<RuleName, RuleDefinition> = {
  subscribesOnParagraph: {
    name: "subscribesOnParagraph",
    author: "Paragraph",
    authorUrl: "https://paragraph.xyz",
    authorIcon: `/icons/paragraph2.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Subscribes on Paragraph",
    checkType: "user",
    description: "Check if the cast author has an active subscription on paragraph.xyz",
    hidden: false,
    invertable: false,
    args: {
      farcasterUser: {
        type: "farcasterUserPicker",
        friendlyName: "Farcaster Username",
        required: true,
        description: "The farcaster user who owns the paragraph publication.",
      },
    },
  },
};
