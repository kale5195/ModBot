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

type RuleName = "hasIcebreakerCredential" | "hasIcebreakerHuman" | "hasIcebreakerQBuilder" | "hasIcebreakerVerified";

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
    friendlyName: "Icebreaker Verified",
    checkType: "user",
    description: "Check if the user has the Icebreaker Verified credential",
    hidden: false,
    invertable: true,
    args: {},
  },
} as const;

export const iceBreakerRulesFunction: Record<RuleName, CheckFunction> = {
  hasIcebreakerHuman: hasIcebreakerHuman,
  hasIcebreakerQBuilder: hasIcebreakerQBuilder,
  hasIcebreakerVerified: hasIcebreakerVerified,
  hasIcebreakerCredential: hasIcebreakerCredential,
} as const;
