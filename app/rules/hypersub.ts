import { getAddress, getContract } from "viem";
import { polygon } from "viem/chains";
import { hypersubAbi721 } from "~/lib/abis";
import { formatHash } from "~/lib/utils.server";
import { clientsByChainId } from "~/lib/viem.server";
import { CheckFunction, CheckFunctionArgs, RuleDefinition } from "~/rules/rules.type";

async function holdsActiveHypersub(args: CheckFunctionArgs) {
  const { user, rule } = args;
  const { chainId, contractAddress, name } = rule.args;
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
    const balance = await contract.read.balanceOf([getAddress(address)]);
    if (balance > 0) {
      isSubscribed = true;
      break;
    }
  }

  return {
    result: isSubscribed,
    message: isSubscribed
      ? `User holds an active hypersub (${name || formatHash(contractAddress)})`
      : `User does not hold an active hypersub (${name || formatHash(contractAddress)})`,
  };
}

type RuleName = "requireActiveHypersub";

export const hypersubRulesDefinitions: Record<RuleName, RuleDefinition> = {
  requireActiveHypersub: {
    name: "requireActiveHypersub",
    author: "Hypersub",
    authorUrl: "https://hypersub.withfarbic.xyz",
    authorIcon: `/icons/fabric.svg`,
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
      name: {
        type: "string",
        required: true,
        friendlyName: "Membership Name",
        placeholder: "e.g. Buoy Pro",
        description: "The name of the membership for display in the UI.",
      },
    },
  },
};

export const hypersubRulesFunction: Record<RuleName, CheckFunction> = {
  requireActiveHypersub: holdsActiveHypersub,
};
