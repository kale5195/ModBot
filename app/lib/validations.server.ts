/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { detect } from "tinyld";
import * as Sentry from "@sentry/remix";
import mimeType from "mime-types";
import RE2 from "re2";
import { z } from "zod";
import { getWarpcastChannel, getWarpcastChannelOwner } from "./warpcast.server";
import { ModeratedChannel } from "@prisma/client";
import { neynar } from "./neynar.server";
import emojiRegex from "emoji-regex";
import { clientsByChainId, hamChain } from "./viem.server";
import { erc20Abi, erc721Abi, getAddress, getContract, parseUnits } from "viem";
import {
  formatHash,
  getSetCache,
  isWarpcastCastUrl,
  validateErc1155,
  validateErc20,
  validateErc721,
} from "./utils.server";
import { WebhookCast } from "./types";
import { erc1155Abi, hypersubAbi721 } from "./abis";
import { languages } from "./languages";
import { chainIdToChainName, nftsByWallets } from "./simplehash.server";
import { db } from "./db.server";
import { Cast, CastId, User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import axios, { AxiosError } from "axios";
import { base, polygon } from "viem/chains";
import {
  getVestingContractsForAddresses,
  searchChannelFanToken,
  farRank,
  userFollowsChannel as airstackUserFollowsChannel,
} from "./airstack.server";
import { hideQuietly, mute, addToBypass, downvote, cooldown, grantRole, ban, unlike } from "./automod.server";
import { PlanType } from "~/lib/utils";

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
  category: "all" | "inclusion" | "exclusion";

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

const hostUrl = ""; //getSharedEnv().hostUrl;

export const ruleDefinitions: Record<RuleName, RuleDefinition> = {
  and: {
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
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
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
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
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "inclusion",
    friendlyName: "Always Include",
    checkType: "cast",
    description: "Always includes the member. Useful if you want to default all in except for a few rules.",
    hidden: false,
    invertable: false,
    args: {},
  },

  // webhook: {
  //   name: "webhook",
  //   author: "automod",
  //   authorUrl: "https://automod.sh",
  //   authorIcon: `${hostUrl}/icons/automod.png`,
  //   allowMultiple: false,
  //   category: "all",
  //   friendlyName: "Webhook",
  //   checkType: "user",
  //   description: "Use an external service to determine if the rule shoulud be triggered.",
  //   hidden: false,
  //   invertable: false,
  //   minimumPlan: "prime",
  //   args: {
  //     url: {
  //       type: "string",
  //       friendlyName: "URL",
  //       placeholder: "https://example.com/webhook",
  //       required: true,
  //       description:
  //         "A post request will be made with { cast, user } data. If the webhook returns a 200, the rule will be triggered, if it returns a 400, it will not. Return a json response in either case with a message to include a reason in the activity logs. Maximum of 75 characters. A response must return within 5 seconds. Example: HTTP POST example.com/webhook { user, cast } -> 200 {'message': 'User belongs to mickey mouse club'}",
  //     },
  //     failureMode: {
  //       type: "select",
  //       required: true,
  //       friendlyName: "If the webhook fails or times out...",
  //       description:
  //         "Example: Let's say you have only this rule in the section \"When any of the following rules are met, include the cast in Main\". If you choose 'Trigger this rule' and the webhook fails, the cast will be included in Main. If you choose 'Do not trigger this rule', the cast will not be included in Main.",
  //       defaultValue: "doNotTrigger",
  //       options: [
  //         { value: "trigger", label: "Trigger this rule" },
  //         { value: "doNotTrigger", label: "Do not trigger this rule" },
  //       ],
  //     },
  //   },
  // },

  subscribesOnParagraph: {
    name: "subscribesOnParagraph",
    author: "Paragraph",
    authorUrl: "https://paragraph.xyz",
    authorIcon: `${hostUrl}/icons/paragraph2.png`,
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

  holdsFanToken: {
    name: "holdsFanToken",
    author: "Moxie",
    authorUrl: "https://moxie.xyz",
    authorIcon: `${hostUrl}/icons/moxie.png`,
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
        description:
          "If you don't see the token you're looking for, it may not be available yet. Check airstack.xyz",
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
    authorIcon: `${hostUrl}/icons/moxie.png`,
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
  isHuman: {
    name: "isHuman",
    author: "botornot",
    authorUrl: "https://warpcast.com/botornot",
    authorIcon: `${hostUrl}/icons/botornot.png`,
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
  userDoesNotFollow: {
    name: "userDoesNotFollow",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Following",
    checkType: "user",
    description: "Check if the cast author follows certain accounts",
    hidden: false,
    invertable: false,
    args: {
      users: {
        type: "farcasterUserPickerMulti",
        required: true,
        friendlyName: "Farcaster Usernames",
        placeholder: "Enter a username...",
        description:
          "Example: If you enter jtgi and riotgoools, it will check that the cast author follows either jtgi or riotgools.",
      },
    },
  },

  userIsNotFollowedBy: {
    name: "userIsNotFollowedBy",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Followed By",
    checkType: "user",
    description: "Check if the cast author is followed by certain accounts",
    hidden: false,
    invertable: true,
    args: {
      users: {
        type: "farcasterUserPickerMulti",
        required: true,
        friendlyName: "Usernames",
        placeholder: "Enter a username...",
        description:
          "Example: If you enter jtgi and riotgoools, it will check that either jtgi or riotgools follow the cast author.",
      },
    },
  },

  requireActiveHypersub: {
    name: "requireActiveHypersub",
    author: "Hypersub",
    authorUrl: "https://hypersub.withfarbic.xyz",
    authorIcon: `${hostUrl}/icons/fabric.svg`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Subscribes on Hypersub",
    checkType: "user",
    description: "Check if the user has an active subscription to a hypersub.",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
          { value: String(polygon.id), label: "Polygon" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
    },
  },

  requiresErc20: {
    name: "requiresErc20",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Holds ERC-20",
    checkType: "user",
    description: "Check that the user holds a certain amount of ERC-20 tokens in their connected wallets.",
    invertedDescription: "Check for users who do hold the ERC-20",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
          { value: String(hamChain.id), label: "Ham" },
          { value: String(polygon.id), label: "Polygon" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        friendlyName: "Contract Address",
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        description: "",
      },
      minBalance: {
        type: "string",
        required: false,
        placeholder: "Any Amount",
        friendlyName: "Minimum Balance (optional)",
        pattern: "^[0-9]+(\\.[0-9]+)?$",
        description: "",
      },
    },
  },

  airstackSocialCapitalRank: {
    name: "airstackSocialCapitalRank",
    author: "Airstack",
    authorUrl: "https://airstack.xyz",
    authorIcon: `${hostUrl}/icons/airstack.png`,
    allowMultiple: false,
    hidden: false,
    category: "all",
    friendlyName: " FarRank by Airstack",
    checkType: "user",
    description: "Check if a user's Airstack FarRank is high enough.",
    invertable: false,
    args: {
      minRank: {
        type: "number",
        friendlyName: "Minimum Rank",
        required: true,
        placeholder: "e.g. 100",
        description: "Example: if you enter 100, the rule will check that the user's FarRank is 1 to 100.",
      },
    },
  },

  requiresErc1155: {
    name: "requiresErc1155",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Holds ERC-1155",
    checkType: "user",
    description: "Require users holds a certain ERC-1155 token",
    invertedDescription: "Check for users who *do* hold the ERC-1155 token",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
          { value: String(polygon.id), label: "Polygon" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
      tokenId: {
        type: "string",
        required: false,
        placeholder: "Any Token",
        pattern: "[0-9]+",
        friendlyName: "Token ID (optional)",
        description: "Optionally check for a specific token id, if left blank any token is valid.",
      },
    },
  },

  requiresErc721: {
    name: "requiresErc721",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Holds ERC-721",
    checkType: "user",
    description: "Require users holds a certain ERC-721 token",
    invertedDescription: "Check for users who *do* hold the ERC-721 token",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
          { value: String(polygon.id), label: "Polygon" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
      tokenId: {
        type: "string",
        required: false,
        placeholder: "Any Token",
        pattern: "[0-9]+",
        friendlyName: "Token ID (optional)",
        description: "",
      },
    },
  },

  userDoesNotHoldPowerBadge: {
    name: "userDoesNotHoldPowerBadge",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
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


  userProfileContainsText: {
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    name: "userProfileContainsText",
    allowMultiple: true,
    category: "all",
    friendlyName: "Profile Contains Text",
    checkType: "user",
    description: "Check if the user's profile contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked, 'abc' is different from 'ABC'",
      },
    },
  },
  userDisplayNameContainsText: {
    name: "userDisplayNameContainsText",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "User Display Name Contains Text",
    checkType: "user",
    description: "Check if the user's display name contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        required: true,
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked 'abc' is different from 'ABC'",
      },
    },
  },

  userFollowsChannel: {
    name: "userFollowsChannel",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Follows Channel",
    checkType: "user",
    hidden: false,
    invertable: false,
    description: "Check if the user follows a channel",
    args: {
      channelSlug: {
        type: "string",
        friendlyName: "Channel ID",
        placeholder: "dont-do-this",
        required: true,
        pattern: "/^[a-zA-Z0-9-]+$/",
        description: "The id of the channel to check",
      },
    },
  },

  userFollowerCount: {
    name: "userFollowerCount",
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "User Follower Count",
    checkType: "user",
    hidden: false,
    invertable: false,
    description: "Check if the user's follower count is within a range",
    args: {
      min: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "If you enter 10, the rule will trigger if the user has less than 10 followers.",
      },
      max: {
        type: "number",
        friendlyName: "More than",
        placeholder: "No Maximum",
        description: "If you enter 50, the rule will trigger if the user has more than 50 followers.",
      },
    },
  },

  openRankGlobalEngagement: {
    name: "openRankGlobalEngagement",
    author: "OpenRank",
    authorUrl: "https://openrank.com",
    authorIcon: `${hostUrl}/icons/openrank.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "Global Ranking by OpenRank",
    checkType: "cast",
    description: "Require the cast author to have a sufficient global ranking.",
    hidden: false,
    invertable: false,
    args: {
      minRank: {
        type: "number",
        friendlyName: "Minimum Rank",
        required: true,
        description:
          "Example: if you enter 100, this rule will check for users ranked 1 to 100. Rankings are based on engagement from trusted accounts.",
      },
    },
  },

  openRankChannel: {
    name: "openRankChannel",
    author: "OpenRank",
    authorUrl: "https://openrank.com",
    authorIcon: `${hostUrl}/icons/openrank.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "Channel Ranking by OpenRank",
    channelGated: ["memes", "design", "sonata"],
    checkType: "cast",
    description: "Require the cast author to have a sufficient channel ranking.",
    hidden: false,
    invertable: false,
    args: {
      minRank: {
        type: "number",
        friendlyName: "Minimum Rank",
        required: true,
        description:
          "Example: if you enter 100, this rule will trigger for users ranked 1 to 100 in your channel. Rankings are based on engagement from trusted accounts within your channel.",
      },
    },
  },

  userFidInList: {
    name: "userFidInList",
    allowMultiple: false,
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    category: "all",
    friendlyName: "User in List",
    checkType: "user",
    description: "Check if the cast author is on a list",
    hidden: false,
    invertable: true,
    args: {
      fids: {
        type: "farcasterUserPickerMulti",
        friendlyName: "Farcaster Usernames",
        required: true,
        placeholder: "Enter a username...",
        description: "",
      },
    },
  },

  userFidInRange: {
    name: "userFidInRange",
    allowMultiple: false,
    author: "automod",
    authorUrl: "https://automod.sh",
    authorIcon: `${hostUrl}/icons/automod.png`,
    category: "all",
    friendlyName: "User FID",
    checkType: "user",
    description: "Check if the user's FID is less than or greater than a certain value",
    hidden: false,
    invertable: false,
    args: {
      minFid: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "Setting a value of 5 would trigger this rule if the fid is 1 thru 4",
      },
      maxFid: {
        type: "number",
        friendlyName: "More than",
        description: "Setting a value of 10 would trigger this rule if the fid is 11 or above.",
      },
    },
  },
} as const;

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
    friendlyName: "Hide",
    hidden: false,
    castScope: "all",
    description: "Hide the cast from the Main feed",
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
    friendlyName: "Curate",
    hidden: true,
    castScope: "root",
    description: "Curate a cast into the Main feed.",
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

export const ruleNames = [
  "and",
  "or",
  "isHuman",
  "alwaysInclude",
  "airstackSocialCapitalRank",
  "openRankGlobalEngagement",
  "openRankChannel",
  "subscribesOnParagraph",
  "holdsFanToken",
  "holdsChannelFanToken",
  "userProfileContainsText",
  "userDisplayNameContainsText",
  "userFollowsChannel",
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
] as const;

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

export type RuleName = (typeof ruleNames)[number];
export type ActionType = (typeof actionTypes)[number];

export type CheckFunctionArgs = {
  channel: ModeratedChannel;
  user: User;
  rule: Rule;
};

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

const BaseRuleSchema = z.object({
  name: z.enum(ruleNames),
  type: z.union([z.literal("CONDITION"), z.literal("LOGICAL")]),
  args: z.record(z.any()),
  operation: z.union([z.literal("AND"), z.literal("OR")]).optional(),
});

export type Rule = z.infer<typeof BaseRuleSchema> & {
  conditions?: Rule[];
};

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
      if (data.name === "userFollowsChannel") {
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

export const ruleFunctions: Record<RuleName, CheckFunction> = {
  and: () => ({ result: true, message: "And rule always passes" }),
  or: () => ({ result: true, message: "Or rule always passes" }),
  alwaysInclude: () => ({ result: true, message: "Everything included by default" }),
  airstackSocialCapitalRank: airstackSocialCapitalRank,
  subscribesOnParagraph: subscribesOnParagraph,
  isHuman: isHuman,
  holdsChannelFanToken: holdsChannelFanToken,
  holdsFanToken: holdsFanToken,
  openRankChannel: openRankChannel,
  openRankGlobalEngagement: openRankGlobalEngagement,
  userProfileContainsText: userProfileContainsText,
  userDoesNotFollow: userFollows,
  userIsNotFollowedBy: userFollowedBy,
  userDisplayNameContainsText: userDisplayNameContainsText,
  userFollowsChannel: userFollowsChannel,
  userFollowerCount: userFollowerCount,
  userDoesNotHoldPowerBadge: userHoldsPowerBadge,
  userFidInList: userFidInList,
  userFidInRange: userFidInRange,
  requireActiveHypersub: holdsActiveHypersub,
  requiresErc721: holdsErc721,
  requiresErc20: holdsErc20,
  requiresErc1155: holdsErc1155,
  // webhook: webhook,
};

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
  // const signerAlloc = await db.signerAllocation.findFirst({
  //   where: {
  //     channelId: props.channel,
  //   },
  //   include: {
  //     signer: true,
  //   },
  // });

  // const uuid = signerAlloc?.signer.signerUuid || process.env.NEYNAR_SIGNER_UUID!;
  // console.log(`Liking with @${signerAlloc ? signerAlloc.signer.username : "automod"}, ${uuid}`);
  // await neynar.publishReactionToCast(uuid, "like", props.cast.hash);
}



type BotOrNotResponse = { fid: number; result: { bot?: boolean; status: "complete" | "analyzing" } };

export async function isHuman(args: CheckFunctionArgs) {
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


export async function userFidInList(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { fids } = rule.args as { fids: Array<{ value: number; icon: string; label: string }> };

  const result = fids.some((f) => f.value === user.fid);

  return {
    result,
    message: result
      ? `@${user.username} is in the list`
      : `@${user.username} is not in the list`,
  };
}

export async function airstackSocialCapitalRank(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { minRank } = rule.args as { minRank: number };

  const rank = await getSetCache({
    key: `airstack-social-capital-rank:${user.fid}`,
    ttlSeconds: 60 * 60 * 24,
    get: () => farRank({ fid: user.fid }).then((res) => (res === null ? Infinity : res)),
  });

  if (rank === Infinity) {
    console.error(`User's FarRank is not available: ${user.fid}`);
    return {
      result: false,
      message: "User's social FarRank is not available",
    };
  }

  return {
    result: rank <= minRank,
    message:
      rank <= minRank
        ? `User FarRank is #${rank.toLocaleString()}, higher than #${minRank.toLocaleString()}`
        : `User's FarRank is #${rank.toLocaleString()}, lower than #${minRank.toLocaleString()}`,
  };
}

export async function subscribesOnParagraph(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { farcasterUser } = rule.args as { farcasterUser: { value: number; label: string; icon: string } };

  const isSubbed = await getSetCache({
    key: `paragraph-subscribers:${farcasterUser.value}:${user.fid}`,
    ttlSeconds: 60 * 5,
    get: async () => {
      const rsp = await neynar.fetchSubscribersForFid(farcasterUser.value, "paragraph");
      const isSubbed = rsp.subscribers?.some((s) => s.user.fid === user.fid) || false;
      return isSubbed;
    },
  });

  return {
    result: isSubbed,
    message: isSubbed
      ? `User is subscribed to @${farcasterUser.label} on Paragraph `
      : `User is not subscribed to @${farcasterUser.label} on Paragraph`,
  };
}


export function userProfileContainsText(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { searchText, caseSensitive } = rule.args;
  const containsText = !caseSensitive
    ? user.profile.bio.text?.toLowerCase().includes(searchText.toLowerCase())
    : user.profile.bio.text?.includes(searchText);

  return {
    result: containsText,
    message: containsText ? `Profile contains "${searchText}"` : `Profile does not contain "${searchText}"`,
  };
}

export async function holdsChannelFanToken(args: CheckFunctionArgs) {
  const { user, rule, channel } = args;
  const { contractAddress, minBalance } = rule.args;

  const authorAddresses = [user.custody_address, ...user.verifications];

  const vestingContracts = await getSetCache({
    key: `vesting-contract-address:${user.fid}`,
    get: async () => getVestingContractsForAddresses({ addresses: authorAddresses }),
    ttlSeconds: 60 * 60,
  });

  authorAddresses.push(...vestingContracts.tokenLockWallets.map((w) => w.id));

  const cacheKey = `erc20-balance:${contractAddress}:${minBalance}:${authorAddresses.join(",")}`;

  const { result: hasEnough } = await getSetCache({
    key: cacheKey,
    get: async () =>
      verifyErc20Balance({
        wallets: authorAddresses,
        chainId: String(base.id),
        contractAddress,
        minBalanceRequired: minBalance,
      }),
    ttlSeconds: 60 * 60 * 2,
  });

  return {
    result: hasEnough,
    message: hasEnough ? `Holds /${channel.id} Fan Token` : `Does not hold enough /${channel.id} Fan Token`,
  };
}

export async function holdsFanToken(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const {
    minBalance,
    fanToken: { value: contractAddress, label },
  } = rule.args;

  const authorAddresses = [user.custody_address, ...user.verifications];

  const vestingContracts = await getSetCache({
    key: `vesting-contract-address:${user.fid}`,
    get: async () => getVestingContractsForAddresses({ addresses: authorAddresses }),
    ttlSeconds: 60 * 60,
  });

  authorAddresses.push(...vestingContracts.tokenLockWallets.map((w) => w.id));

  const cacheKey = `erc20-balance:${contractAddress}:${minBalance}:${authorAddresses.join(",")}`;
  const { result: hasEnough } = await getSetCache({
    key: cacheKey,
    get: async () =>
      verifyErc20Balance({
        wallets: authorAddresses,
        chainId: String(base.id),
        contractAddress,
        minBalanceRequired: minBalance,
      }),
    ttlSeconds: 60 * 60 * 2,
  });

  return {
    result: hasEnough,
    message: hasEnough
      ? `User holds @${label}'s Fan Token`
      : `User does not hold enough of @${label}'s Fan Token`,
  };
}

export async function userFollowsChannel(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { channelSlug } = rule.args;

  const follows = await getSetCache({
    key: `follows:${channelSlug}:${user.fid}`,
    ttlSeconds: 60 * 5,
    get: () => airstackUserFollowsChannel({ fid: user.fid, channelId: channelSlug }),
  });

  return {
    result: follows,
    message: follows ? `User follows /${channelSlug}` : `User does not follow /${channelSlug}`,
  };
}

export function userDisplayNameContainsText(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { searchText, caseSensitive } = rule.args;

  if (!user.display_name) {
    Sentry.captureMessage(`Cast author has no display name: ${user.fid}`, {
      extra: {
        user,
      },
    });

    return {
      result: false,
      message: "User has no display name",
    };
  }

  const containsText = !caseSensitive
    ? user.display_name.toLowerCase().includes(searchText.toLowerCase())
    : user.display_name.includes(searchText);

  return {
    result: containsText,
    message: containsText
      ? `Display name contains "${searchText}"`
      : `Display name does not contain "${searchText}"`,
  };
}

export function userFollowerCount(props: CheckFunctionArgs) {
  const { user, rule } = props;
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (user.follower_count < min) {
      return {
        result: true,
        message: `User has less than ${min} followers`,
      };
    }
  }

  if (max) {
    if (user.follower_count > max) {
      return {
        result: true,
        message: `User has more than ${max} followers`,
      };
    }
  }

  return {
    result: false,
    message: "User follower count is within limits",
  };
}

export async function userFollowedBy(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { users } = rule.args as { users: SelectOption[] };

  if (users.some((u) => u.value === user.fid)) {
    return {
      result: true,
      message: "User implicitly followed by themselves",
    };
  }

  const followingStatus = await getSetCache({
    key: `followedby:${users
      .map((u) => u.value)
      .sort()
      .join(":")}:${user.fid}`,
    ttlSeconds: 60,
    get: () =>
      neynar
        .fetchBulkUsers(
          users.map((u) => u.value),
          {
            viewerFid: user.fid,
          }
        )
        .then((rsp) => rsp.users),
  });

  const isFollowing = followingStatus.find((f) => f.viewer_context?.followed_by);

  return {
    result: !!isFollowing,
    message: isFollowing
      ? `@${user.username} is followed by @${isFollowing.username}`
      : `@${user.username} is not followed by ${
          users.length > 1 ? `any of ${users.map((u) => `@${u.label}`).join(", ")}` : `@${users[0].label}`
        }`,
  };
}

export type SelectOption = {
  label: string;
  value: number;
  icon?: string;
};

export async function userFollows(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { users } = rule.args as { users: SelectOption[] };

  if (users.some((u) => u.value === user.fid)) {
    return {
      result: true,
      message: "User implicitly follow themselves",
    };
  }

  const followingStatus = await getSetCache({
    key: `follows:${users
      .map((u) => u.value)
      .sort()
      .join(":")}:${user.fid}`,
    ttlSeconds: 60,
    get: () =>
      neynar
        .fetchBulkUsers(
          users.map((u) => u.value),
          {
            viewerFid: user.fid,
          }
        )
        .catch((err) => {
          console.error(err);
          return Promise.reject(err);
        })
        .then((rsp) => rsp.users),
  });

  const isFollowing = followingStatus.find((f) => f.viewer_context?.following);
  return {
    result: !!isFollowing,
    message: isFollowing
      ? `@${user.username} follows @${isFollowing.username}`
      : `@${user.username} does not follow ${
          users.length > 1 ? `any of ${users.map((u) => `@${u.label}`).join(", ")}` : `@${users[0].label}`
        }`,
  };
}

export async function userIsCohostOrOwner(args: CheckFunctionArgs) {
  const { user, channel } = args;

  const [isUserCohost, ownerFid] = await Promise.all([
    isCohost({
      fid: user.fid,
      channel: channel.id,
    }),
    getWarpcastChannelOwner({ channel: channel.id }),
  ]);

  const isOwner = ownerFid === user.fid;
  const isCohostOrOwner = isUserCohost || isOwner;

  return {
    result: isCohostOrOwner,
    message: isCohostOrOwner ? "User is a cohost or owner" : "User is not a cohost or owner",
  };
}

export function userHoldsPowerBadge(args: CheckFunctionArgs) {
  const { user } = args;
  const author = user as User & { power_badge: boolean };

  return {
    result: author.power_badge,
    message: author.power_badge ? "User holds a power badge" : "User does not hold a power badge",
  };
}

export async function holdsErc721(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, tokenId } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  let isOwner = false;
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: erc721Abi,
    client,
  });

  if (tokenId) {
    isOwner = await getSetCache({
      key: `erc721-owner:${contractAddress}:${tokenId}`,
      get: async () => {
        const owner = await contract.read.ownerOf([BigInt(tokenId)]);
        return [user.custody_address, ...user.verifications].some(
          (address) => address.toLowerCase() === owner.toLowerCase()
        );
      },
      ttlSeconds: 60 * 60 * 2,
    });
  } else {
    for (const address of [user.custody_address, ...user.verifications]) {
      const balance = await getSetCache({
        key: `erc721-balance:${contractAddress}:${address}`,
        get: () => contract.read.balanceOf([getAddress(address)]),
        ttlSeconds: 60 * 60 * 2,
      });

      if (balance > 0) {
        isOwner = true;
        break;
      }
    }
  }

  return {
    result: isOwner,
    message: isOwner
      ? `User holds ERC-721 (${formatHash(contractAddress)})`
      : `User does not hold ERC-721 (${formatHash(contractAddress)})`,
  };
}

export async function holdsActiveHypersub(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  let isSubscribed = false;
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: hypersubAbi721,
    client,
  });

  for (const address of [user.custody_address, ...user.verifications]) {
    const balance = await getSetCache({
      key: `hypersub:${contractAddress}:${address}`,
      get: () => contract.read.balanceOf([getAddress(address)]),
      ttlSeconds: 60 * 60 * 2,
    });

    if (balance > 0) {
      isSubscribed = true;
      break;
    }
  }

  return {
    result: isSubscribed,
    message: isSubscribed
      ? `User holds an active hypersub (${formatHash(contractAddress)})`
      : `User does not hold an active hypersub (${formatHash(contractAddress)})`,
  };
}

// export async function webhook(args: CheckFunctionArgs) {
//   const { user, rule } = args;
//   const { url, failureMode } = rule.args;

//   const maxTimeout = 5_000;

//   // dont throw on 400
//   return axios
//     .post(
//       url,
//       {
//         user,
//       },
//       {
//         timeout: maxTimeout,
//         validateStatus: (status) => (status >= 200 && status < 300) || status === 400,
//       }
//     )
//     .then((response) => {
//       let message = response.data.message?.substring(0, 75);
//       if (!message) {
//         message = response.status === 200 ? "Webhook rule triggered" : "Webhook rule did not trigger";
//       }

//       return {
//         result: response.status === 200,
//         message,
//       };
//     })
//     .catch((err: AxiosError) => {
//       console.error(
//         `[${args.channel.id}] webhook to ${url} failed`,
//         err.response?.status,
//         err.response?.statusText,
//         err.response?.data
//       );

//       if (err.code === "ECONNABORTED") {
//         return {
//           result: failureMode === "trigger" ? true : false,
//           message:
//             failureMode === "trigger"
//               ? `Webhook didn't respond within ${maxTimeout / 1000}s, rule is set to trigger on failure`
//               : `Webhook did not respond within ${
//                   maxTimeout / 1000
//                 }s, rule is set to not trigger on failure. `,
//         };
//       } else {
//         return {
//           result: failureMode === "trigger" ? true : false,
//           message:
//             failureMode === "trigger"
//               ? "Webhook failed but rule is set to trigger on failure"
//               : "Webhook failed and rule is set to not trigger on failure",
//         };
//       }
//     });
// }

export async function holdsErc1155(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, tokenId } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  if (!tokenId) {
    const chain = chainIdToChainName({ chainId });

    if (!chain) {
      throw new Error(`No chain found for chainId: ${chainId}`);
    }

    const nfts = await nftsByWallets({
      wallets: [user.custody_address, ...user.verifications.filter((v) => v.startsWith("0x"))],
      contractAddresses: [contractAddress],
      chains: [chain],
    });

    const isOwner = nfts.count && nfts.count > 0;
    return {
      result: isOwner,
      message: isOwner
        ? `User holds ERC-1155 (${formatHash(contractAddress)})`
        : `User does not hold ERC-1155 (${formatHash(contractAddress)})`,
    };
  } else {
    const contract = getContract({
      address: getAddress(contractAddress),
      abi: erc1155Abi,
      client,
    });

    let isOwner = false;
    for (const address of [user.custody_address, ...user.verifications]) {
      const balance = await getSetCache({
        key: `erc1155-${contractAddress}-${address}-${tokenId}`,
        get: () => contract.read.balanceOf([getAddress(address), BigInt(tokenId)]),
        ttlSeconds: 60 * 60 * 2,
      });

      if (balance > 0) {
        isOwner = true;
        break;
      }
    }

    return {
      result: isOwner,
      message: isOwner
        ? `User holds ERC-1155 (${formatHash(contractAddress)}), Token #${tokenId}`
        : `User does not hold ERC-1155 (${formatHash(contractAddress)}), Token #${tokenId}`,
    };
  }
}

export async function holdsErc20(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, minBalance } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  const cacheKey = `erc20-balance:${contractAddress}:${minBalance}:${
    user.custody_address
  }:${user.verifications.join(`,`)}`;

  const { result: hasEnough } = await getSetCache({
    key: cacheKey,
    get: async () =>
      verifyErc20Balance({
        wallets: [user.custody_address, ...user.verifications],
        chainId,
        contractAddress,
        minBalanceRequired: minBalance,
      }),
    ttlSeconds: 60 * 60 * 2,
  });

  return {
    result: hasEnough,
    message: hasEnough
      ? `User holds ERC-20 (${formatHash(contractAddress)})`
      : `User does not hold enough ERC-20 (${formatHash(contractAddress)})`,
  };
}

export async function verifyErc20Balance({
  wallets,
  chainId,
  contractAddress,
  minBalanceRequired,
}: {
  wallets: string[];
  chainId: string;
  contractAddress: string;
  minBalanceRequired?: string;
}) {
  const client = clientsByChainId[chainId];
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: erc20Abi,
    client,
  });

  const balances = (await Promise.all(
    wallets.map((add) => contract.read.balanceOf([getAddress(add)]))
  )) as bigint[];
  const decimals = await contract.read.decimals();
  const minBalanceBigInt = parseUnits(minBalanceRequired ?? "0", decimals);
  const sum = balances.reduce((a, b) => a + b, BigInt(0));

  return {
    result: sum >= minBalanceBigInt && sum > BigInt(0),
    balance: sum,
    contract,
  };
}

// Rule: user fid must be in range
export function userFidInRange(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { minFid, maxFid } = rule.args as { minFid?: number; maxFid?: number };

  if (minFid) {
    if (user.fid < minFid) {
      return {
        result: true,
        message: `FID #${user.fid} is less than ${minFid}`,
      };
    }
  }

  if (maxFid) {
    if (user.fid > maxFid) {
      return {
        result: true,
        message: `FID #${user.fid} is greater than ${maxFid}`,
      };
    }
  }

  let failureMessage = "";
  if (minFid && maxFid) {
    failureMessage = `FID #${user.fid} is not between ${minFid} and ${maxFid}`;
  } else if (minFid) {
    failureMessage = `FID #${user.fid} is greater than ${minFid}`;
  } else if (maxFid) {
    failureMessage = `FID #${user.fid} is less than ${maxFid}`;
  }

  return {
    result: false,
    message: failureMessage,
  };
}

function tryParseUrl(url: string) {
  try {
    return new URL(url);
  } catch (e) {
    return undefined;
  }
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

async function openRankChannel(props: CheckFunctionArgs) {
  const { user:member, rule, channel } = props;
  const { minRank } = rule.args as { minRank: number };

  const user = await getSetCache({
    key: `openrank:channel-rank:${channel.id}:${member.fid}`,
    ttlSeconds: 60 * 60 * 6,
    get: () =>
      axios
        .post<GlobalRankResponse>(
          `https://graph.cast.k3l.io/priority/channels/rankings/${channel.id}/fids`,
          [member.fid],
          {
            headers: {
              "API-Key": process.env.OPENRANK_API_KEY,
            },
          }
        )
        .then((res) => res.data.result.find((u) => u.fid === member.fid)),
  });

  if (!user) {
    return {
      result: false,
      message: `@${member.username} is not in /${channel.id} rankings`,
    };
  }

  return {
    result: user.rank <= minRank,
    message:
      user.rank <= minRank
        ? `@${member.username} is ranked #${user.rank} in /${channel.id}`
        : `@${member.username} is not a top ${minRank} account in ${channel.id}. Their current rank is #${user.rank}.`,
  };
}

type GlobalRankResponse = {
  result: Array<{
    fid: number;
    fname: string;
    username: string;
    rank: number;
    score: number;
    percentile: number;
  }>;
};

async function openRankGlobalEngagement(props: CheckFunctionArgs) {
  const { user:member, rule } = props;
  const { minRank } = rule.args as { minRank: number };

  const user = await getSetCache({
    key: `openrank:global-rank:${member.fid}`,
    ttlSeconds: 60 * 60 * 6,
    get: () =>
      axios
        .post<GlobalRankResponse>(
          `https://graph.cast.k3l.io/priority/scores/global/engagement/fids`,
          [member.fid],
          {
            headers: {
              "API-Key": process.env.OPENRANK_API_KEY,
            },
          }
        )
        .then((res) => res.data.result.find((u) => u.fid === member.fid)),
  });

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in global rankings`,
    };
  }

  return {
    result: user.rank <= minRank,
    message:
      user.rank <= minRank
        ? `@${member.username} is ranked #${user.rank}`
        : `@${member.username} is not a top ${minRank} account. Their current rank is #${user.rank}.`,
  };
}
