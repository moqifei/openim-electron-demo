import { AD_LOGIN_KEY_ID, AD_LOGIN_SHARED_KEY } from "@/config/adLoginCrypto";

export type ADLoginChallenge = {
  challengeID: string;
  challengeNonce: string;
  keyID: string;
  expiresAt: number;
};

type ADLoginCredentials = {
  username: string;
  password: string;
  platform: number;
  deviceID?: string;
};

export type ADLoginCredential = {
  version: "v1";
  keyID: string;
  challengeID: string;
  nonce: string;
  ciphertext: string;
};

const encoder = new TextEncoder();

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const base64 = (bytes: ArrayBuffer) => {
  let result = "";
  for (const byte of new Uint8Array(bytes)) result += String.fromCharCode(byte);
  return btoa(result);
};

export const createEncryptedADLoginCredential = async (
  challenge: ADLoginChallenge,
  credentials: ADLoginCredentials,
): Promise<ADLoginCredential> => {
  if (challenge.keyID !== AD_LOGIN_KEY_ID)
    throw new Error("Unsupported AD login encryption key");

  const aesKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(AD_LOGIN_SHARED_KEY),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(
    `v1\n${challenge.keyID}\n${challenge.challengeID}`,
  );
  const payload = encoder.encode(
    JSON.stringify({
      ...credentials,
      challengeID: challenge.challengeID,
      challengeNonce: challenge.challengeNonce,
    }),
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData },
    aesKey,
    payload,
  );

  return {
    version: "v1",
    keyID: challenge.keyID,
    challengeID: challenge.challengeID,
    nonce: base64(nonce.buffer),
    ciphertext: base64(ciphertext),
  };
};
