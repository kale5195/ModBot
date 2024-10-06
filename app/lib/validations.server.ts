/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { inviteToChannel } from "./neynar.server";
import { validateErc1155, validateErc20, validateErc721 } from "./utils.server";
import { db } from "./db.server";

import { searchChannelFanToken } from "./airstack.server";
import { hideQuietly, mute, addToBypass, downvote, cooldown, grantRole, ban, unlike } from "./automod.server";
import { BaseRuleSchema, CheckFunctionArgs, Rule, RuleDefinition, RuleName, User } from "~/rules/rules.type";
import { iceBreakerRulesDefinitions, iceBreakerRulesFunction } from "~/rules/icebreaker";
import { ercTokenRulesDefinitions, ercTokenRulesFunction } from "~/rules/erc-tokens";
import { fantokenRulesDefinitions, fantokenRulesFunction } from "~/rules/fantoken";
import { userFidRulesDefinitions, userFidRulesFunction } from "~/rules/user-fid";
import { hypersubRulesDefinitions, hypersubRulesFunction } from "~/rules/hypersub";
import { openrankRulesDefinitions, openrankRulesFunction } from "~/rules/openrank";
import { userProfileRulesDefinitions, userProfileRulesFunction } from "~/rules/user-profile";
import { userFollowRulesDefinitions, userFollowRulesFunction } from "~/rules/user-follow";
import { regularRulesDefinitions, regularRulesFunction } from "~/rules/regular";
import { paragraphRulesDefinitions, paragraphRulesFunction } from "~/rules/paragrah";
import { powerbadgeRulesDefinitions, powerbadgeRulesFunction } from "~/rules/powerbadge";
import { airstackRulesDefinitions, airstackRulesFunction } from "~/rules/airstack";
import { botOrNotRulesDefinitions, botOrNotRulesFunction } from "~/rules/bot-or-not";
import { channelMemberRulesDefinitions, channelMemberRulesFunction } from "~/rules/membership";
import { getWarpcastChannel } from "~/lib/warpcast.server";

export const ruleDefinitions: Record<RuleName, RuleDefinition> = {
  ...botOrNotRulesDefinitions,
  ...airstackRulesDefinitions,
  ...powerbadgeRulesDefinitions,
  ...paragraphRulesDefinitions,
  ...regularRulesDefinitions,
  ...userFollowRulesDefinitions,
  ...userProfileRulesDefinitions,
  ...openrankRulesDefinitions,
  ...fantokenRulesDefinitions,
  ...hypersubRulesDefinitions,
  ...userFidRulesDefinitions,
  ...ercTokenRulesDefinitions,
  ...iceBreakerRulesDefinitions,
  ...channelMemberRulesDefinitions,
} as const;

export const ruleFunctions: Record<RuleName, CheckFunction> = {
  ...botOrNotRulesFunction,
  ...airstackRulesFunction,
  ...powerbadgeRulesFunction,
  ...paragraphRulesFunction,
  ...regularRulesFunction,
  ...userFollowRulesFunction,
  ...userProfileRulesFunction,
  ...openrankRulesFunction,
  ...hypersubRulesFunction,
  ...userFidRulesFunction,
  ...fantokenRulesFunction,
  ...ercTokenRulesFunction,
  ...iceBreakerRulesFunction,
  ...channelMemberRulesFunction,
  // webhook: webhook,
};
export type ActionDefinition = {
  friendlyName: string;
  description: string;
  /**
   * Hide the action from the customer facing UI
   * Example: "Bypass" is hidden because it's a special action.
   * Note: this is prob an abstraction leak, but it's fine for now.
   */
  hidden?: boolean;
  /**
   * Whether the action can be applied to root casts, reply, or all
   * Example: "Boost" only makes sense for root.
   */
  castScope?: "root" | "reply" | "all";

  args: Record<
    string,
    | {
        type: "number" | "string" | "boolean";
        friendlyName: string;
        description: string;
        required?: boolean;
      }
    | {
        type: "radio" | "select";
        friendlyName: string;
        description: string;
        options: Array<{ value: string; label: string }>;
        required?: boolean;
      }
  >;
};

export const actionDefinitions = {
  // deprecate
  mute: {
    friendlyName: "Mute",
    hidden: true,
    castScope: "all",
    description: "All this user's casts will be silently hidden from the channel until you unmute.",
    args: {},
  },
  hideQuietly: {
    friendlyName: "Declined",
    hidden: false,
    castScope: "all",
    description: "Not inviting the user to the channel",
    args: {},
  },
  addToBypass: {
    friendlyName: "Add to Bypass",
    hidden: true,
    castScope: "all",
    description: "Add the user to the bypass list so their casts always appear in Main.",
    args: {},
  },
  bypass: {
    friendlyName: "Bypass",
    castScope: "all",
    description: "Bypass the rule and let the cast be visible",
    hidden: true,
    args: {},
  },
  ban: {
    friendlyName: "Ban",
    hidden: false,
    castScope: "all",
    description: "Ban all future posts from appearing in the Main feed",
    args: {},
  },
  downvote: {
    friendlyName: "Downvote",
    hidden: true,
    castScope: "all",
    description:
      "Increase the downvote count. Configure a rule to trigger after a certain threshold of downvotes has been reached.",
    args: {},
  },
  like: {
    friendlyName: "Invited",
    hidden: true,
    castScope: "root",
    description: "Invite the user to the channel.",
    args: {},
  },
  unlike: {
    friendlyName: "Hide",
    hidden: true,
    castScope: "root",
    description: "Hide a cast from the Main feed.",
    args: {},
  },
  warnAndHide: {
    friendlyName: "Warn and Hide",
    castScope: "all",
    hidden: true,
    description: "Hide the cast and let them know it was hidden via a notification",
    args: {},
  },
  unmuted: {
    friendlyName: "Unmuted",
    castScope: "all",
    description: "Unmute the user",
    hidden: true,
    args: {},
  },
  cooldownEnded: {
    friendlyName: "End Cooldown",
    castScope: "all",
    description: "End the user's cooldown period",
    hidden: true,
    args: {},
  },
  unhide: {
    friendlyName: "Unhide",
    castScope: "all",
    description: "Unhide the cast",
    hidden: true,
    args: {},
  },
  cooldown: {
    friendlyName: "Cooldown",
    castScope: "all",
    hidden: false,
    description: "Casts from this user will not be curated into Main for the duration specified.",
    args: {
      duration: {
        type: "number",
        friendlyName: "Duration (hours)",
        description: "The duration of the cool down in hours",
      },
    },
  },
  grantRole: {
    friendlyName: "Grant Role",
    castScope: "all",
    hidden: true,
    description: "Grant a role to a user",
    args: {
      // TODO: this needs to be dynamic, rip.
      role: {
        type: "string",
        friendlyName: "Role",
        description: "The role to grant",
      },
    },
  },
} as const satisfies Record<ActionType, ActionDefinition>;

export const actionTypes = [
  "bypass",
  "addToBypass",
  "hideQuietly",
  "downvote",
  "ban",
  "unlike",
  "like",
  "mute",
  "warnAndHide",
  "cooldown",
  "cooldownEnded",
  "unhide",
  "unmuted",
  "grantRole",
] as const;

export type ActionType = (typeof actionTypes)[number];

export type CheckFunctionResult = {
  result: boolean;
  message: string;
};
export type CheckFunction = (props: CheckFunctionArgs) => CheckFunctionResult | Promise<CheckFunctionResult>;
export type ActionFunction<T = any> = (args: {
  channel: string;
  user: User;
  action: Action;
  options?: { executeOnProtocol?: boolean };
}) => Promise<T>;

export const RuleSchema: z.ZodType<Rule> = BaseRuleSchema.extend({
  conditions: z.lazy(() => RuleSchema.array()).optional(), // z.lazy is used for recursive schemas
})
  .transform(async (data) => {
    if (data.name === "holdsChannelFanToken") {
      const contractAddress = await searchChannelFanToken({ channelId: data.args.channelId });
      return {
        ...data,
        args: {
          ...data.args,
          contractAddress: contractAddress?.id,
          symbol: contractAddress?.symbol,
        },
      };
    }

    return data;
  })
  .refine(
    (data) => {
      if (data.name === "holdsChannelFanToken") {
        return !!data.args.contractAddress;
      }

      return true;
    },
    {
      message: "Your channel doesn't have a Fan Token yet. Contact /airstack",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "userIsChannelMember") {
        const channel = await getWarpcastChannel({ channel: data.args.channelSlug }).catch(() => null);

        if (!channel) {
          return false;
        }
      }

      return true;
    },
    {
      message: `Couldn't find that channel. Sure you got it right?`,
    }
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc721") {
        return await validateErc721({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-721 contract. Sure you got the right chain?",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc1155") {
        return await validateErc1155({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
          tokenId: data.args.tokenId,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-1155 contract. Sure you got the right chain?",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc20") {
        return await validateErc20({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-20 contract. Sure you got the right chain?",
    }
  )
  .transform(async (data) => {
    return data;
  });

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bypass") }),
  z.object({ type: z.literal("hideQuietly") }),
  z.object({ type: z.literal("like") }),
  z.object({ type: z.literal("unlike") }),
  z.object({ type: z.literal("ban") }),
  z.object({ type: z.literal("addToBypass") }),
  z.object({
    type: z.literal("downvote"),
    args: z.object({
      voterFid: z.string(),
      voterUsername: z.string(),
      voterAvatarUrl: z.string(),
    }),
  }),
  z.object({ type: z.literal("warnAndHide") }),
  z.object({ type: z.literal("mute") }),
  z.object({ type: z.literal("cooldownEnded") }),
  z.object({ type: z.literal("unmuted") }),
  z.object({ type: z.literal("unhide") }),
  z.object({
    type: z.literal("grantRole"),
    args: z.object({ role: z.string() }),
  }),
  z.object({
    type: z.literal("cooldown"),
    args: z.object({ duration: z.coerce.number() }),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

export const RuleSetSchema = z.object({
  id: z.string().optional(),
  target: z.enum(["all", "root", "reply"]).default("all"),
  ruleParsed: RuleSchema,
  active: z.boolean().default(true),
  actionsParsed: z.array(ActionSchema).min(1, { message: "At least one action is required." }),
});

export type RuleSetSchemaType = z.infer<typeof RuleSetSchema>;

export const ModeratedChannelSchema = z
  .object({
    id: z.string().transform((id) => id.toLowerCase()),
    banThreshold: z.coerce.number().nullable(),
    slowModeHours: z.coerce.number().optional().default(0),
    excludeUsernames: z
      .array(z.object({ value: z.number(), label: z.string(), icon: z.string().optional() }))
      .default([]),
    excludeCohosts: z.boolean().default(true),
    ruleSets: z.array(RuleSetSchema),

    inclusionRuleSet: RuleSetSchema,
    exclusionRuleSet: RuleSetSchema,
  })
  .refine(
    (data) => {
      if (
        data.inclusionRuleSet?.ruleParsed?.conditions?.length === 0 &&
        data.exclusionRuleSet?.ruleParsed?.conditions?.length !== 0
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'You need least one rule that includes casts.\n\nIf you just want to specify what to exclude, add the "Always Include" rule.',
    }
  );

export const actionFunctions: Record<ActionType, ActionFunction> = {
  hideQuietly: hideQuietly,
  mute: mute,
  bypass: () => Promise.resolve(),
  addToBypass: addToBypass,
  downvote: downvote,
  cooldownEnded: () => Promise.resolve(),
  unmuted: () => Promise.resolve(),
  unhide: () => Promise.resolve(),
  ban: ban,
  like: like,
  unlike: unlike,
  warnAndHide: () => Promise.resolve(),
  cooldown: cooldown,
  grantRole: grantRole,
} as const;

export async function like(props: { user: User; channel: string }) {
  const { user, channel } = props;
  console.log("invite", user.username, channel);
  await inviteToChannel({ channelId: channel, fid: user.fid });
}

export async function isCohost(props: { fid: number; channel: string }) {
  const role = await db.role.findFirst({
    where: {
      channelId: props.channel,
      isCohostRole: true,
    },
    include: {
      delegates: true,
    },
  });

  if (!role) {
    return false;
  }

  return role.delegates.some((d) => d.fid === String(props.fid));
}

export function getRuleDefinitions(fid: string, channelId?: string): Record<RuleName, RuleDefinition> {
  // filter by object value's if fid in value.fidAccess
  const filteredRules = {};
  for (const [key, value] of Object.entries(ruleDefinitions)) {
    if (value.fidGated && !value.fidGated.includes(parseInt(fid))) {
      continue;
    } else if (value.channelGated && (!channelId || !value.channelGated.includes(channelId))) {
      continue;
    } else {
      // @ts-ignore
      filteredRules[key] = value;
    }
  }

  return filteredRules as Record<RuleName, RuleDefinition>;
}
