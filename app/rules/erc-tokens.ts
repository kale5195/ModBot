import { clientsByChainId, hamChain } from "~/lib/viem.server";
import { erc20Abi, erc721Abi, getAddress, getContract, parseUnits } from "viem";
import { formatHash, getSetCache } from "~/lib/utils.server";
import { chainIdToChainName, nftsByWallets } from "~/lib/simplehash.server";
import { erc1155Abi } from "~/lib/abis";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";
import { polygon } from "viem/chains";

async function holdsErc721(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, tokenId, name } = rule.args;
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
      ? `User holds ERC-721 (${name || formatHash(contractAddress)})`
      : `User does not hold ERC-721 (${name || formatHash(contractAddress)})`,
  };
}

export async function holdsErc1155(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, tokenId, name } = rule.args;
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
        ? `User holds ERC-1155 (${name || formatHash(contractAddress)})`
        : `User does not hold ERC-1155 (${name || formatHash(contractAddress)})`,
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

async function holdsErc20(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, minBalance, name } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  const cacheKey = `erc20-balance:${contractAddress}:${minBalance}:${user.custody_address}:${user.verifications.join(
    `,`
  )}`;

  const { result: hasEnough } = await verifyErc20Balance({
    wallets: [user.custody_address, ...user.verifications],
    chainId,
    contractAddress,
    minBalanceRequired: minBalance,
  });

  return {
    result: hasEnough,
    message: hasEnough
      ? `User holds ERC-20 (${name || formatHash(contractAddress)})`
      : `Needs to hold ${minBalance} ERC-20 (${name || formatHash(contractAddress)})`,
  };
}

async function verifyErc20Balance({
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

  const balances = (await Promise.all(wallets.map((add) => contract.read.balanceOf([getAddress(add)])))) as bigint[];
  const decimals = await contract.read.decimals();
  const minBalanceBigInt = parseUnits(minBalanceRequired ?? "0", decimals);
  const sum = balances.reduce((a, b) => a + b, BigInt(0));

  return {
    result: sum >= minBalanceBigInt && sum > BigInt(0),
    balance: sum,
    contract,
  };
}

type RuleName = "requiresErc1155" | "requiresErc721" | "requiresErc20";

export const ercTokenRulesDefinitions: Record<RuleName, RuleDefinition> = {
  requiresErc1155: {
    name: "requiresErc1155",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Holds ERC-1155",
    checkType: "user",
    description: "Require the user holds a certain ERC-1155 token",
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
      name: {
        type: "string",
        required: true,
        friendlyName: "Token Name",
        placeholder: "e.g. Rocks NFT",
        description: "The name of the NFT for display in the UI.",
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
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "all",
    friendlyName: "Holds ERC-721",
    checkType: "user",
    description: "Require the user holds a certain ERC-721 token",
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
      name: {
        type: "string",
        required: true,
        friendlyName: "Token Name",
        placeholder: "e.g. BAYC NFT",
        description: "The name of the NFT for display in the UI.",
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
  requiresErc20: {
    name: "requiresErc20",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
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
      name: {
        type: "string",
        required: true,
        friendlyName: "Token Name",
        placeholder: "e.g. $DEGEN",
        description: "The name of the token for display in the UI.",
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
};

export const ercTokenRulesFunction: Record<RuleName, CheckFunction> = {
  requiresErc721: holdsErc721,
  requiresErc20: holdsErc20,
  requiresErc1155: holdsErc1155,
};
