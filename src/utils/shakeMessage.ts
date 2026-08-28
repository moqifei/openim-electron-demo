import { SessionType } from "@openim/wasm-client-sdk";
import type {
  ConversationItem,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";

import { isAgentConversation } from "@/utils/agentConversation";

export const CHAT_SHAKE_CUSTOM_TYPE = 901;
export const CHAT_SHAKE_TEXT = "向您发送了一个抖动窗口";

const parseShakeData = (data?: string) => {
  if (!data) return undefined;
  try {
    return JSON.parse(data) as { customType?: number };
  } catch {
    return undefined;
  }
};

export const canUseShake = (
  conversation?: ConversationItem,
  latestMessage?: MessageItem,
) =>
  conversation?.conversationType === SessionType.Single &&
  !isAgentConversation(conversation, latestMessage);

export const buildShakeMessageData = () =>
  JSON.stringify({
    customType: CHAT_SHAKE_CUSTOM_TYPE,
  });

export const isShakeMessageData = (data?: string) =>
  parseShakeData(data)?.customType === CHAT_SHAKE_CUSTOM_TYPE;

export const getShakeMessageText = (data?: string, senderNickname?: string) => {
  if (!isShakeMessageData(data)) return "";
  const sender = senderNickname?.trim() || "对方";
  return `${sender}${CHAT_SHAKE_TEXT}`;
};
