import { ModeratedChannel } from "@prisma/client";
import { PlanType } from "~/lib/utils";
import { z } from "zod";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export const ruleNames = [
  "and",
  "or",
  "isHuman",
  "alwaysInclude",
  "manuallyApprove",
  "airstackSocialCapitalRank",
  "openRankGlobalEngagement",
  "openRankChannel",
  "subscribesOnParagraph",
  "holdsFanToken",
  "holdsChannelFanToken",
  "userProfileContainsText",
  "userDisplayNameContainsText",
  "webhook",
  "userIsChannelMember",
  "userFollowerCount",
  "userDoesNotFollow",
  "userIsNotFollowedBy",
  "userDoesNotHoldPowerBadge",
  "userFidInList",
  "userFidInRange",
  "requireActiveHypersub",
  "requiresErc1155",
  "requiresErc721",
  "requiresErc20",
  "hasIcebreakerHuman",
  "hasIcebreakerBot",
  "hasIcebreakerQBuilder",
  "hasIcebreakerVerified",
  "hasIcebreakerCredential",
  "hasIcebreakerLinkedAccount",
  "hasGuildRole",
  "hasPOAP",
  "hasVerifiedTwitterCreatedBefore",
  "hasVerifiedTwitterFollowersGreaterThan",
  "membershipFeeRequired",
  "containsText",
  "containsEmbeds",
  "textMatchesPattern",
  "textMatchesLanguage",
  "castLength",
  "containsTooManyMentions",
  "containsLinks",
] as const;

export type RuleName = (typeof ruleNames)[number];

export type RuleDefinition = {
  name: RuleName;
  author: string;
  authorUrl?: string;
  authorIcon?: string;
  minimumPlan?: PlanType;
  icon?: string;
  friendlyName: string;

  // Gate rule access to fids
  fidGated?: Array<number>;

  // Gate rule access to channels
  channelGated?: Array<string>;
  checkType: "user" | "cast";
  description: string;

  // Where this rule can be used
  category: "all" | "inclusion" | "exclusion" | "cast";

  // Whether this rule can be used multiple times in a rule set
  // example: containsText can be used many times, power badge can't
  allowMultiple: boolean;
  invertedDescription?: string;
  hidden: boolean | (() => boolean);
  invertable: boolean;
  args: Record<
    string,
    {
      type: string;
      defaultValue?: string | number | boolean;
      placeholder?: string;
      friendlyName: string;
      description: string;
      pattern?: string;
      tooltip?: string;
      required?: boolean;
      options?: Array<{ value: string; label: string; hint?: string }>;
    }
  >;
};

export type CheckFunctionResult = {
  result: boolean;
  message: string;
};
export type CheckFunction = (props: CheckFunctionArgs) => CheckFunctionResult | Promise<CheckFunctionResult>;

export const BaseRuleSchema = z.object({
  name: z.enum(ruleNames),
  type: z.union([z.literal("CONDITION"), z.literal("LOGICAL")]),
  args: z.record(z.any()),
  operation: z.union([z.literal("AND"), z.literal("OR")]).optional(),
});

export type Rule = z.infer<typeof BaseRuleSchema> & {
  conditions?: Rule[];
};
export type User = {
  fid: number;
  verifications: string[];
  custody_address: string;
  username: string;
  display_name?: string;
  follower_count: number;
  following_count: number;
  pfp_url?: string;
  profile: {
    bio: {
      text: string;
    };
  };
};
export type CheckFunctionArgs = {
  channel: ModeratedChannel;
  user: User;
  rule: Rule;
  cast?: Cast;
};

export type SelectOption = {
  label: string;
  value: number;
  icon?: string;
};
