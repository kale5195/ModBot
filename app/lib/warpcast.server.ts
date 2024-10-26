import { getSetCache } from "./utils.server";
import { http } from "./http.server";
import { generateAuthToken } from "./authkey.server";

export async function getWarpcastChannelOwner(props: { channel: string }): Promise<number> {
  const channel = await getWarpcastChannel(props);
  return channel.leadFid;
}

export type WarpcastChannel = {
  id: string;
  url: string;
  name: string;
  description: string;
  imageUrl: string;
  leadFid: number;
  hostFids: number[];
  moderatorFids: number[];
  createdAt: number;
  followerCount: number;
};

export const warpcastChannelCacheKey = (channel: string) => `warpcast-channel-${channel.toLowerCase()}`;

export async function getWarpcastChannel(props: { channel: string }): Promise<WarpcastChannel> {
  const rsp = await http.get(`https://api.warpcast.com/v1/channel?channelId=${props.channel.toLowerCase()}`);
  return rsp.data.result.channel;
}

export async function getWarpcastChannels() {
  return getSetCache({
    key: `all-warpcast-channels`,
    get: async () => {
      const rsp = await http.get<{ result: { channels: Array<WarpcastChannel> } }>(
        `https://api.warpcast.com/v2/all-channels`
      );
      return rsp.data.result.channels;
    },
    ttlSeconds: 60 * 5,
  });
}

export async function isChannelInvited(props: { channel: string; fid: number }) {
  const { channel, fid } = props;
  const rsp = await http.get<{ result: { invites: [] } }>(
    `https://api.warpcast.com/fc/channel-invites?channelId=${channel}&fid=${fid}`
  );
  return rsp.data.result.invites.length > 0;
}

export async function isFollowingChannel(props: { channel: string; fid: number }) {
  const { channel, fid } = props;
  const rsp = await http.get<{ result: { following: boolean } }>(
    `https://api.warpcast.com/v1/user-channel?fid=${fid}&channelId=${channel}`
  );
  return rsp.data.result.following;
}

export async function isChannelMember(props: { channel: string; fid: number }) {
  const { channel, fid } = props;
  const rsp = await http.get<{ result: { members: Array<{ fid: number }> } }>(
    `https://api.warpcast.com/fc/channel-members?fid=${fid}&channelId=${channel}`
  );
  return rsp.data.result.members.length > 0;
}
export async function isBannedByChannel(props: { channel: string; fid: number }) {
  const { channel, fid } = props;
  const rsp = await http.get<{ result: { restrictedUsers: Array<{ fid: number }> } }>(
    `https://api.warpcast.com/fc/channel-restricted-users?fid=${fid}&channelId=${channel}`
  );
  return rsp.data.result.restrictedUsers.length > 0;
}

export async function getOwnedChannels(props: { fid: number }) {
  const channels = await getWarpcastChannels();
  return channels.filter((c) => c.leadFid === props.fid);
}

export async function getCast(props: { hash: string; username: string }) {
  return http
    .get<{ result: { casts: Array<{ text: string; timestamp: number }> } }>(
      `https://client.warpcast.com/v2/user-thread-casts?castHashPrefix=${props.hash.substring(0, 10)}&username=${
        props.username
      }`
    )
    .then((rsp) => rsp.data.result?.casts[0]);
}

export async function moderateCast(props: { hash: string; action: "hide" | "unhide" }) {
  const { hash, action } = props;
  const authToken = await generateAuthToken();
  const res = await http.post<{ result: { success: boolean } }>(
    `https://api.warpcast.com/fc/moderated-casts`,
    {
      castHash: hash,
      action: action,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  console.log(hash, res.data.result.success);
  return res.data.result.success;
}
