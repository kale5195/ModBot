/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NobleEd25519Signer } from "@farcaster/hub-nodejs";

export async function generateAuthToken() {
  try {
    const fid = 861203;
    const privateKey = `${process.env.MOD_PRIVATE_KEY}` as unknown as Uint8Array;
    const publicKey = `${process.env.MOD_PUBLIC_KEY}`;

    const signer = new NobleEd25519Signer(privateKey);

    const header = {
      fid,
      type: "app_key",
      key: publicKey,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payload = { exp: Math.floor(Date.now() / 1000) + 300 }; // 5 minutes
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const signatureResult = await signer.signMessageHash(Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf-8"));
    const encodedSignature = Buffer.from(signatureResult.value).toString("base64url");

    const authToken = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    return authToken;
  } catch (error) {
    console.log(error);
    return error;
  }
}
