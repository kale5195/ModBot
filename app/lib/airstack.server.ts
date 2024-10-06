import { gql, GraphQLClient } from "graphql-request";
import { neynar } from "./neynar.server";

import { fetchQuery, init } from "@airstack/node";

init(process.env.AIRSTACK_API_KEY!);

const protocolStats = new GraphQLClient(
  `https://gateway-arbitrum.network.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/7zS29h4BDSujQq8R3TFF37JfpjtPQsRUpoC9p4vo4scx`
);

export type TokenLockWallet = {
  tokenLockWallets: [
    {
      beneficiary: string;
      id: string;
    }
  ];
};

export type SubjectTokensResponse = {
  subjectTokens: Array<{
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    pfpUrl?: string;
  }>;
};

export async function searchChannelFanToken({ channelId }: { channelId: string }) {
  const query = gql`
    query MyQuery {
      subjectTokens(where: { symbol: "cid:${channelId}" }, first: 1) {
        name
        id
        symbol
        decimals
      }
    }
  `;

  const data = await protocolStats.request<SubjectTokensResponse>(query);
  return data.subjectTokens.length ? data.subjectTokens[0] : null;
}

export async function userFollowsChannel(props: { fid: number; channelId: string }) {
  const query = gql`
    query MyQuery {
      FarcasterChannelParticipants(
        input: {
          filter: {
            participant: { _eq: "fc_fid:${props.fid}" }
            channelId: { _eq: "${props.channelId}" }
            channelActions: { _eq: follow }
          }
          blockchain: ALL
        }
      ) {
        FarcasterChannelParticipant {
          lastActionTimestamp
        }
      }
    }
  `;

  const { data } = await fetchQuery(query);
  return !!data.FarcasterChannelParticipants?.FarcasterChannelParticipant;
}

export async function holdingFanTokenBalance({ fid, symbol }: { fid: number; symbol: string }) {
  const query = gql`
    query GetPortfolioInfo {
      MoxieUserPortfolios(
        input: { filter: { walletAddress: {}, fanTokenSymbol: { _eq: "${symbol}" }, fid: { _eq: "${fid}" } } }
      ) {
        MoxieUserPortfolio {
          totalUnlockedAmount
          totalLockedAmount
        }
      }
    }
  `;

  const { data } = await fetchQuery(query);
  if (!data?.MoxieUserPortfolios?.MoxieUserPortfolio) {
    return 0;
  }
  const unlocked = Number(data.MoxieUserPortfolios.MoxieUserPortfolio[0].totalUnlockedAmount);
  const locked = Number(data.MoxieUserPortfolios.MoxieUserPortfolio[0].totalLockedAmount);
  const total = (unlocked + locked) / Math.pow(10, 18);
  return total;
}

export async function farRank(props: { fid: number }) {
  const query = gql`
    query MyQuery {
      Socials(
        input: {
          filter: { dappName: { _eq: farcaster }, identity: { _eq: "fc_fid:${props.fid}" } }
          blockchain: ethereum
        }
      ) {
        Social {
          farcasterScore {
            farRank
          }
        }
      }
    }
  `;

  const { data, error } = await fetchQuery(query);

  if (error) {
    console.error(error);
    return null;
  }

  const rank = data.Socials.Social[0]?.farcasterScore?.farRank;

  if (!rank) {
    return null;
  }

  return data.Socials.Social[0].farcasterScore.farRank;
}

export async function searchMemberFanTokens({ username }: { username: string }) {
  const query = gql`
    query MyQuery {
      subjectTokens(where: { symbol_starts_with: "fid:", name_starts_with: "${username}" }, first: 10) {
        name
        id
        symbol
        decimals
      }
    }
  `;

  const data = (await protocolStats.request(query)) as SubjectTokensResponse;

  const fids = data.subjectTokens
    .filter((token) => token.symbol.includes("fid:"))
    .map((token) => Number(token.symbol.split("fid:")[1]))
    .filter(Boolean);
  const profiles = fids.length ? await neynar.fetchBulkUsers(fids).then((res) => res.users) : [];

  data.subjectTokens = data.subjectTokens.map((token) => {
    const profile = profiles.find((profile) => `fid:${profile.fid}` === token.symbol);
    return {
      ...token,
      pfpUrl: profile?.pfp_url,
    };
  });
  return data;
}
