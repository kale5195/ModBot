import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ActionFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { parseEther } from "viem";
import { db } from "~/lib/db.server";
import { parseMessage } from "~/lib/utils.server";
export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "channel id is required");
  const channelId = params.channel;
  const data = await request.json();
  const message = await parseMessage(data);
  const user = message.action.interactor as User;
  const paymentAddress = data.untrustedData.address;
  // parse frames
  // get price and address from channel
  const channel = await db.moderatedChannel.findFirst({ where: { id: channelId } });
  if (!channel) {
    throw new Error("Channel not found");
  }

  const rules = channel.inclusionRuleSetParsed?.ruleParsed.conditions?.find(
    (rule) => rule.name === "membershipFeeRequired"
  );
  if (!rules) {
    throw new Error("Membership fee rule not found");
  }
  const { receiveAddress, feeAmount } = rules.args;

  const price = parseEther(feeAmount).toString();
  // create order
  const channelOrder = await db.channelOrder.create({
    data: {
      channelId,
      fid: user.fid.toString(),
      address: receiveAddress,
    },
  });
  const jsonData = { id: channelOrder.id };
  const hexData = ("0x" + Buffer.from(JSON.stringify(jsonData)).toString("hex")) as `0x${string}`;
  return json(
    {
      chainId: "eip155:8453",
      method: "eth_sendTransaction",
      params: {
        abi: [],
        value: price,
        to: receiveAddress,
        data: hexData,
      },
    },
    { status: 200 }
  );
}
