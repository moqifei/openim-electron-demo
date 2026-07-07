import { SessionType } from "@openim/wasm-client-sdk";
import type {
  ConversationItem,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";

import { BOT_PLATFORM_ID } from "@/utils/digitalTwinMessage";

type PlainRecord = Record<string, unknown>;

const BOT_USER_ID_PREFIX = "bot_";

const numberField = (record: PlainRecord | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "number" ? value : undefined;
};

const parseLatestMessage = (latestMsg?: string): MessageItem | undefined => {
  if (!latestMsg) return undefined;
  try {
    return JSON.parse(latestMsg) as MessageItem;
  } catch (error) {
    return undefined;
  }
};

export const isAgentConversation = (
  conversation?: ConversationItem,
  latestMessage?: MessageItem,
) => {
  if (!conversation || conversation.conversationType !== SessionType.Single) {
    return false;
  }

  if (conversation.userID?.startsWith(BOT_USER_ID_PREFIX)) return true;

  const conversationRecord = conversation as unknown as PlainRecord;
  if (numberField(conversationRecord, "platformID") === BOT_PLATFORM_ID) return true;

  const message = latestMessage ?? parseLatestMessage(conversation.latestMsg);
  if (!message) return false;

  return (
    message.senderPlatformID === BOT_PLATFORM_ID ||
    numberField(message as unknown as PlainRecord, "recvPlatformID") === BOT_PLATFORM_ID
  );
};

