import { http } from "./http.server";
import { getSetCache } from "./utils.server";

export type IcebreakerChannel = {
  type: string;
  isVerified?: boolean;
  isLocked?: boolean;
  value?: string;
  url?: string;
};

export type IcebreakerCredential = {
  name: string;
  chain: string;
  source?: string;
  reference?: string;
};

export type IcebreakerHighlight = {
  title?: string;
  url?: string;
};

export type IcebreakerWorkExperience = {
  jobTitle?: string;
  orgWebsite?: string;
  employmentType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isVerified?: boolean;
};

export type IcebreakerProfile = {
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

const API_URL = 'https://app.icebreaker.xyz/api/v1';

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

export async function getIcebreakerbyFid(fid?: number) {
  if (!fid) {
    return;
  }

  const response = await request<ProfileResponse>(`/fid/${fid}`);

  return response?.profiles[0];
}

export function hasCredential(
  credentialName?: string,
  credentials?: IcebreakerCredential[],
  exact = false,
) {
  if (!credentials || !credentialName) {
    return false;
  }

  return credentials.some(({ name }) =>
    exact ? name === credentialName : name.startsWith(credentialName),
  );
}
