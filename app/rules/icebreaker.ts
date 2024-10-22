import { CheckFunctionArgs, RuleDefinition, CheckFunction } from "~/rules/rules.type";
import { http } from "~/lib/http.server";

type IcebreakerChannel = {
  type: string;
  isVerified?: boolean;
  isLocked?: boolean;
  value?: string;
  url?: string;
};

type IcebreakerCredential = {
  name: string;
  chain: string;
  source?: string;
  reference?: string;
};

type IcebreakerHighlight = {
  title?: string;
  url?: string;
};

type IcebreakerWorkExperience = {
  jobTitle?: string;
  orgWebsite?: string;
  employmentType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isVerified?: boolean;
};

type IcebreakerEvent = {
  id: string;
  source: string;
  name: string;
  description?: string;
  eventUrl?: string;
  imageUrl?: string;
};

type IcebreakerGuildMembership = {
  guildId: number;
  roleIds: number[];
  isAdmin: boolean;
  isOwner: boolean;
  joinedAt: Date;
};

type IcebreakerProfile = {
  profileID?: string;
  walletAddress: string;
  avatarUrl?: string;
  displayName?: string;
  jobTitle?: string;
  bio?: string;
  location?: string;
  primarySkill?: string;
  networkingStatus?: string;
  channels?: IcebreakerChannel[];
  credentials?: IcebreakerCredential[];
  highlights?: IcebreakerHighlight[];
  workExperience?: IcebreakerWorkExperience[];
  events?: IcebreakerEvent[];
  guilds?: IcebreakerGuildMembership[];
};

export type UserMetadata = {
  name: string;
  value: string | number;
};

export type UserMetadataApiResponse =
  | {
      metadata?: UserMetadata[];
    }
  | undefined;

const API_URL = "https://app.icebreaker.xyz/api/v1";
const TWITTER_API_URL = "https://hook.us1.make.com/h4yqha7yee9juaosenjrmebd956va0ew?twitter=";

async function request<T>(path: string, options?: RequestInit) {
  try {
    const response = await http.get<T>(`${API_URL}${path}`);

    return response.data;
  } catch (err) {
    console.error(err);
    return;
  }
}

async function getTwitterMetadata(username?: string) {
  if (!username) {
    return;
  }

  const response = await request<UserMetadataApiResponse>(`${TWITTER_API_URL}${username}`);

  return response?.metadata;
}

function extractTwitterFollowerCount(metadata?: UserMetadata[]) {
  if (!metadata) {
    return;
  }

  const followerCount = metadata?.find(({ name }) => name === "followers_count")?.value as number | undefined;
  return followerCount;
}

function extractTwitterCreatedAt(metadata?: UserMetadata[]) {
  if (!metadata) {
    return;
  }

  const createdAt = metadata?.find(({ name }) => name === "created_at")?.value;
  return createdAt ? new Date(createdAt) : undefined;
}

type ProfileResponse = {
  profiles: IcebreakerProfile[];
};

async function getIcebreakerbyFid(fid?: number) {
  if (!fid) {
    return;
  }

  const response = await request<ProfileResponse>(`/fid/${fid}`);

  return response?.profiles[0];
}

function hasCredential(credentialName?: string, credentials?: IcebreakerCredential[], exact = false) {
  if (!credentials || !credentialName) {
    return false;
  }

  return credentials.some(({ name }) => (exact ? name === credentialName : name.startsWith(credentialName)));
}

async function hasIcebreakerCredential({ user: member, rule }: CheckFunctionArgs) {
  const { credential, exactMatch } = rule.args as { credential: string; exactMatch: boolean };

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasCredential = hasCredential(credential, user.credentials, exactMatch);

  return {
    result: userHasCredential,
    message: userHasCredential
      ? `@${member.username} has the ${credential} credential`
      : `@${member.username} does not have the ${credential} credential`,
  };
}

async function hasIcebreakerHuman({ user: member }: CheckFunctionArgs) {
  const credential = "Human";

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasCredential = hasCredential(credential, user.credentials, true);

  return {
    result: userHasCredential,
    message: userHasCredential
      ? `@${member.username} has the ${credential} credential`
      : `@${member.username} does not have the ${credential} credential`,
  };
}

async function hasIcebreakerVerified({ user: member }: CheckFunctionArgs) {
  const credential = "Verified:";

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasCredential = hasCredential(credential, user.credentials);

  return {
    result: userHasCredential,
    message: userHasCredential
      ? `@${member.username} has the ${credential} credential`
      : `@${member.username} does not have the ${credential} credential`,
  };
}

async function hasIcebreakerQBuilder({ user: member }: CheckFunctionArgs) {
  const credential = "qBuilder";

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasCredential = hasCredential(credential, user.credentials, true);

  return {
    result: userHasCredential,
    message: userHasCredential
      ? `@${member.username} has the ${credential} credential`
      : `@${member.username} does not have the ${credential} credential`,
  };
}

async function hasIcebreakerLinkedAccount({ user: member, rule }: CheckFunctionArgs) {
  const { account, verified } = rule.args as { account: string; verified: boolean };

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasLinkedAccount =
    user.channels?.some((channel) => channel.type === account && (!verified || channel.isVerified)) ?? false;

  return {
    result: userHasLinkedAccount,
    message: userHasLinkedAccount
      ? `@${member.username} has linked ${verified ? "and verified " : " "}${account}`
      : `@${member.username} does not have linked ${verified ? "and verified " : " "}${account}`,
  };
}

async function hasVerifiedTwitterFollowersGreaterThan({ user: member, rule }: CheckFunctionArgs) {
  const { threshold } = rule.args as { threshold: string };

  if (!threshold || isNaN(+threshold)) {
    return {
      result: false,
      message: "Invalid threshold value",
    };
  }
  const thresholdNumber = +threshold;

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const verifiedTwitterAccount = user.channels?.find(
    (channel) => channel.type === "twitter" && channel.isVerified
  )?.value;

  const metadata = verifiedTwitterAccount ? await getTwitterMetadata(verifiedTwitterAccount) : undefined;

  const followerCount = extractTwitterFollowerCount(metadata);

  const userHasGreaterThanThreshold = !!followerCount && followerCount > thresholdNumber;

  return {
    result: userHasGreaterThanThreshold,
    message: followerCount
      ? `@${member.username} has ${followerCount} followers on Twitter`
      : metadata
      ? `Unable to retrieve follower count for @${member.username}`
      : `Unable to find a verified Twitter account for @${member.username}`,
  };
}

async function hasVerifiedTwitterCreatedBefore({ user: member, rule }: CheckFunctionArgs) {
  const { threshold } = rule.args as { threshold: string };

  const isValidDateFormat = (dateString: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return dateString === date.toISOString().split("T")[0];
  };

  // Check if threshold can be parsed as a valid date
  if (!threshold || !isValidDateFormat(threshold)) {
    return {
      result: false,
      message: "Invalid threshold value. Please provide a valid date.",
    };
  }

  const thresholdDate = new Date(threshold);

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const verifiedTwitterAccount = user.channels?.find(
    (channel) => channel.type === "twitter" && channel.isVerified
  )?.value;

  const metadata = verifiedTwitterAccount ? await getTwitterMetadata(verifiedTwitterAccount) : undefined;

  const createdAt = extractTwitterCreatedAt(metadata);

  const userHasGreaterThanThreshold = !!createdAt && createdAt < thresholdDate;

  return {
    result: userHasGreaterThanThreshold,
    message: createdAt
      ? `@${member.username} created Twitter account on ${createdAt.toDateString()}`
      : metadata
      ? `Unable to retrieve created date for @${member.username}`
      : `Unable to find a verified Twitter account for @${member.username}`,
  };
}

async function hasPOAP({ user: member, rule }: CheckFunctionArgs) {
  const { eventId } = rule.args as { eventId: string };

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const userHasPOAP = user.events?.some((event) => event.source === "poap" && event.id === eventId) ?? false;

  return {
    result: userHasPOAP,
    message: userHasPOAP
      ? `@${member.username} has the POAP ${eventId}`
      : `@${member.username} does not have the POAP ${eventId}`,
  };
}

async function hasGuildRole({ user: member, rule }: CheckFunctionArgs) {
  const { guildId, roleId } = rule.args as { guildId: string; roleId: string | undefined };

  const user = await getIcebreakerbyFid(member.fid);

  if (!user) {
    return {
      result: false,
      message: `@${member.username} not found in Icebreaker`,
    };
  }

  const guild = user.guilds?.find((guild) => guild.guildId === +guildId);

  const userHasGuildRole = (guild && (roleId ? guild.roleIds?.includes(+roleId) ?? false : true)) ?? false;

  return {
    result: userHasGuildRole,
    message: userHasGuildRole
      ? `@${member.username} has the Guild ${guildId}${roleId ? ` with role ${roleId}` : ""}`
      : `@${member.username} does not have the Guild ${guildId}${roleId ? ` with role ${roleId}` : ""}`,
  };
}

type RuleName =
  | "hasIcebreakerCredential"
  | "hasIcebreakerHuman"
  | "hasIcebreakerQBuilder"
  | "hasIcebreakerVerified"
  | "hasIcebreakerLinkedAccount"
  | "hasGuildRole"
  | "hasPOAP"
  | "hasVerifiedTwitterCreatedBefore"
  | "hasVerifiedTwitterFollowersGreaterThan";

const author = "Icebreaker";
const authorUrl = "https://icebreaker.xyz";
const authorIcon = "/icons/icebreaker.png";

export const iceBreakerRulesDefinitions: Record<RuleName, RuleDefinition> = {
  hasIcebreakerCredential: {
    name: "hasIcebreakerCredential",
    allowMultiple: true,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has Credential",
    checkType: "user",
    description: "Check if the user has a specific Icebreaker credential",
    hidden: false,
    invertable: true,
    args: {
      credential: {
        type: "string",
        friendlyName: "Credential",
        description: "The name of the credential",
        placeholder: "Enter a credential...",
        required: true,
      },
      exactMatch: {
        type: "boolean",
        defaultValue: false,
        friendlyName: "Exact credential match",
        description: "Exactly matches the full name of the credential",
        required: false,
      },
    },
  },

  hasIcebreakerHuman: {
    name: "hasIcebreakerHuman",
    allowMultiple: false,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has Human",
    checkType: "user",
    description: "Check if the user has the Icebreaker Human credential",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerQBuilder: {
    name: "hasIcebreakerQBuilder",
    allowMultiple: false,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has QBuilder",
    checkType: "user",
    description: "Check if the user has the Icebreaker QBuilder credential",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerVerified: {
    name: "hasIcebreakerVerified",
    allowMultiple: false,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has Verified Work Domain",
    checkType: "user",
    description: "Check if the user has the Icebreaker Verified credential for a work domain",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerLinkedAccount: {
    name: "hasIcebreakerLinkedAccount",
    allowMultiple: true,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has Linked Account",
    checkType: "user",
    description: "Check if the user has a specific type of linked account",
    hidden: false,
    invertable: true,
    args: {
      account: {
        type: "string",
        friendlyName: "Account",
        description: "The type of account required. Consult Icebreaker Alloy for all types supported",
        placeholder: "Choose one of linkedin, twitter, github, etc.",
        required: true,
      },
      verified: {
        type: "boolean",
        defaultValue: false,
        friendlyName: "Require verified account",
        description: "If enabled, only passes if the account has been verified",
        required: false,
      },
    },
  },

  hasVerifiedTwitterFollowersGreaterThan: {
    name: "hasVerifiedTwitterFollowersGreaterThan",
    allowMultiple: false,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has verified Twitter account with greater than X followers",
    checkType: "user",
    description: "Check if the user has more than a certain number of followers on their verified Twitter account",
    hidden: false,
    invertable: true,
    args: {
      threshold: {
        type: "string",
        pattern: "^[0-9]*$",
        defaultValue: "1000",
        friendlyName: "Follower minimum",
        description: "The minimum number of followers required",
        placeholder: "Enter a number...",
        required: true,
      },
    },
  },

  hasVerifiedTwitterCreatedBefore: {
    name: "hasVerifiedTwitterCreatedBefore",
    allowMultiple: false,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has verified Twitter account created before a date",
    checkType: "user",
    description: "Check if the user has a verified Twitter account created before a given date",
    hidden: false,
    invertable: true,
    args: {
      threshold: {
        type: "string",
        pattern: "^d{4}-d{2}-d{2}$",
        defaultValue: "2021-01-01",
        friendlyName: "Created before",
        description: "The latest creation date of the Twitter account",
        placeholder: "Enter a date in YYYY-MM-DD format...",
        required: true,
      },
    },
  },

  hasPOAP: {
    name: "hasPOAP",
    allowMultiple: true,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has POAP",
    checkType: "user",
    description: "Check via Icebreaker if the user has a specific POAP",
    hidden: false,
    invertable: true,
    args: {
      eventId: {
        type: "string",
        friendlyName: "POAP Event ID",
        description: "The POAP event ID to check for",
        placeholder: "Enter a POAP event ID...",
        required: true,
      },
    },
  },

  hasGuildRole: {
    name: "hasGuildRole",
    allowMultiple: true,
    author,
    authorUrl,
    authorIcon,
    category: "all",
    friendlyName: "Icebreaker: Has Guild Role",
    checkType: "user",
    description: "Check via Icebreaker if the user is a member of a Guild",
    hidden: false,
    invertable: true,
    args: {
      guildId: {
        type: "string",
        friendlyName: "Guild ID",
        description: "The Guild ID to check for",
        placeholder: "Enter a Guild ID...",
        pattern: "^[0-9]+$",
        required: true,
      },
      roleId: {
        type: "string",
        friendlyName: "Role ID",
        description: "Optional role ID to check for",
        placeholder: "Enter a Role ID...",
        pattern: "^[0-9]*$",
        required: false,
      },
    },
  },
} as const;

export const iceBreakerRulesFunction: Record<RuleName, CheckFunction> = {
  hasIcebreakerHuman: hasIcebreakerHuman,
  hasIcebreakerQBuilder: hasIcebreakerQBuilder,
  hasIcebreakerVerified: hasIcebreakerVerified,
  hasIcebreakerCredential: hasIcebreakerCredential,
  hasIcebreakerLinkedAccount: hasIcebreakerLinkedAccount,
  hasGuildRole: hasGuildRole,
  hasPOAP: hasPOAP,
  hasVerifiedTwitterCreatedBefore: hasVerifiedTwitterCreatedBefore,
  hasVerifiedTwitterFollowersGreaterThan: hasVerifiedTwitterFollowersGreaterThan,
} as const;
