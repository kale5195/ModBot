import axios from "axios";
import { getSetCache } from "~/lib/utils.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

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
async function openRankChannel(props: CheckFunctionArgs) {
  const { user: member, rule, channel } = props;
  const { minRank } = rule.args as { minRank: number };

  const user = await getSetCache({
    key: `openrank:channel-rank:${channel.id}:${member.fid}`,
    ttlSeconds: 60 * 60 * 6,
    get: () =>
      axios
        .post<GlobalRankResponse>(
          `https://graph.cast.k3l.io/channels/rankings/${channel.id}/fids`,
          [member.fid]
          // {
          //   headers: {
          //     "API-Key": process.env.OPENRANK_API_KEY,
          //   },
          // }
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

async function openRankGlobalEngagement(props: CheckFunctionArgs) {
  const { user: member, rule } = props;
  const { minRank } = rule.args as { minRank: number };

  const user = await getSetCache({
    key: `openrank:global-rank:${member.fid}`,
    ttlSeconds: 60 * 60 * 6,
    get: () =>
      axios
        .post<GlobalRankResponse>(
          `https://graph.cast.k3l.io/scores/global/engagement/fids`,
          [member.fid]
          // {
          //   headers: {
          //     "API-Key": process.env.OPENRANK_API_KEY,
          //   },
          // }
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

type RuleName = "openRankChannel" | "openRankGlobalEngagement";

export const openrankRulesDefinitions: Record<RuleName, RuleDefinition> = {
  openRankGlobalEngagement: {
    name: "openRankGlobalEngagement",
    author: "OpenRank",
    authorUrl: "https://openrank.com",
    authorIcon: `/icons/openrank.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "Global Ranking by OpenRank",
    checkType: "cast",
    description: "Require the user to have a sufficient global ranking.",
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
    authorIcon: `/icons/openrank.png`,
    allowMultiple: false,
    category: "all",
    friendlyName: "Channel Ranking by OpenRank",
    channelGated: ["memes", "design", "sonata"],
    checkType: "cast",
    description: "Require the user to have a sufficient channel ranking.",
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
};

export const openrankRulesFunction: Record<RuleName, CheckFunction> = {
  openRankChannel,
  openRankGlobalEngagement,
};
