import { getSetCache } from "./utils.server";
import { base, mainnet, optimism, zora } from "viem/chains";
import { http } from "./http.server";

export async function nftsByWallets(props: { chains: string[]; contractAddresses: string[]; wallets: string[] }) {
  const url = new URL(`https://preview.recaster.org/api/nft-proxy`);
  url.searchParams.set("chains", props.chains.join(","));
  url.searchParams.set("contract_addresses", props.contractAddresses.join(","));
  url.searchParams.set("wallet_addresses", props.wallets.join(","));
  url.searchParams.set("count", "1");

  const rsp = await http
    .get(url.toString(), {
      headers: {
        "X-API-KEY": process.env.SIMPLE_HASH_API_KEY!,
      },
    })
    .catch(() => {
      console.error("Failed to fetch nftsByWallets", url.toString());
    });

  return rsp?.data || {};
}

export function chainIdToChainName(props: { chainId: string }) {
  const mapping: Map<string, string> = new Map([
    [String(zora.id), "zora"],
    [String(base.id), "base"],
    [String(optimism.id), "optimism"],
    [String(mainnet.id), "ethereum"],
  ]);

  return mapping.get(props.chainId);
}
