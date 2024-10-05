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
};

const API_URL = "https://app.icebreaker.xyz/api/v1";

async function request<T>(path: string, options?: RequestInit) {
  try {
    const response = await http.get<T>(`${API_URL}${path}`);

    return response.data;
  } catch (err) {
    console.error(err);
    return;
  }
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

type RuleName =
  | "hasIcebreakerCredential"
  | "hasIcebreakerHuman"
  | "hasIcebreakerQBuilder"
  | "hasIcebreakerVerified"
  | "hasIcebreakerLinkedAccount";

export const iceBreakerRulesDefinitions: Record<RuleName, RuleDefinition> = {
  hasIcebreakerCredential: {
    name: "hasIcebreakerCredential",
    allowMultiple: true,
    author: "Icebreaker",
    authorUrl: "https://icebreaker.xyz",
    authorIcon: `/icons/icebreaker.png`,
    category: "all",
    friendlyName: "Icebreaker Credential",
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
    author: "Icebreaker",
    authorUrl: "https://icebreaker.xyz",
    authorIcon: `/icons/icebreaker.png`,
    category: "all",
    friendlyName: "Icebreaker Human",
    checkType: "user",
    description: "Check if the user has the Icebreaker Human credential",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerQBuilder: {
    name: "hasIcebreakerQBuilder",
    allowMultiple: false,
    author: "Icebreaker",
    authorUrl: "https://icebreaker.xyz",
    authorIcon: `/icons/icebreaker.png`,
    category: "all",
    friendlyName: "Icebreaker QBuilder",
    checkType: "user",
    description: "Check if the user has the Icebreaker QBuilder credential",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerVerified: {
    name: "hasIcebreakerVerified",
    allowMultiple: false,
    author: "Icebreaker",
    authorUrl: "https://icebreaker.xyz",
    authorIcon: `/icons/icebreaker.png`,
    category: "all",
    friendlyName: "Icebreaker Work Domain Verified",
    checkType: "user",
    description: "Check if the user has the Icebreaker Verified credential for a work domain",
    hidden: false,
    invertable: true,
    args: {},
  },

  hasIcebreakerLinkedAccount: {
    name: "hasIcebreakerLinkedAccount",
    allowMultiple: true,
    author: "Icebreaker",
    authorUrl: "https://icebreaker.xyz",
    authorIcon: `/icons/icebreaker.png`,
    category: "all",
    friendlyName: "Icebreaker Linked Account",
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
} as const;

export const iceBreakerRulesFunction: Record<RuleName, CheckFunction> = {
  hasIcebreakerHuman: hasIcebreakerHuman,
  hasIcebreakerQBuilder: hasIcebreakerQBuilder,
  hasIcebreakerVerified: hasIcebreakerVerified,
  hasIcebreakerCredential: hasIcebreakerCredential,
  hasIcebreakerLinkedAccount: hasIcebreakerLinkedAccount,
} as const;
