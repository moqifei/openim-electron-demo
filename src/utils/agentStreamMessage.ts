import { MessageItem, MessageType } from "@openim/wasm-client-sdk";

export const AGENT_STREAM_EXT_TYPE = "agent_stream";
export const AGENT_STREAM_EXT_TYPE_FIELD = "openim_ext_type";
export const AGENT_STREAM_VIRTUAL_ID_PREFIX = "agent_stream_";
const AGENT_STREAM_REAL_CLIENT_MSG_ID_FIELD = "__agentStreamRealClientMsgID";

export type AgentStreamEventType =
  | "start"
  | "reasoning"
  | "answer"
  | "final"
  | "error";

export type AgentStreamPayload = {
  openim_ext_type?: string;
  version?: number;
  streamID?: string;
  event?: AgentStreamEventType;
  status?: "streaming" | "done" | "error";
  answerText?: string;
  reasoningText?: string;
  errorText?: string;
  updatedAt?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseMaybeJSON = (value: unknown) => {
  if (!value) return undefined;
  if (isRecord(value)) return value;
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const getAgentStreamPayload = (
  message?: MessageItem,
): AgentStreamPayload | undefined => {
  if (!message || message.contentType !== MessageType.CustomMessage) return undefined;
  const customData = parseMaybeJSON(message.customElem?.data);
  if (!isRecord(customData)) return undefined;
  if (customData[AGENT_STREAM_EXT_TYPE_FIELD] !== AGENT_STREAM_EXT_TYPE) {
    return undefined;
  }
  return customData as AgentStreamPayload;
};

export const isAgentStreamMessage = (message?: MessageItem) =>
  Boolean(getAgentStreamPayload(message));

export const getAgentStreamPreview = (message?: MessageItem) => {
  const payload = getAgentStreamPayload(message);
  if (!payload) return "";
  if (payload.status === "error") return "智能体回复异常";
  if (payload.answerText) return `智能体：${payload.answerText}`;
  if (payload.reasoningText) return "智能体正在思考...";
  return "智能体正在回复...";
};

export const getAgentStreamRealClientMsgID = (message?: MessageItem) => {
  if (!message?.clientMsgID) return "";
  if (!message.clientMsgID.startsWith(AGENT_STREAM_VIRTUAL_ID_PREFIX)) {
    return message.clientMsgID;
  }
  const realClientMsgID = (message as unknown as Record<string, unknown>)[
    AGENT_STREAM_REAL_CLIENT_MSG_ID_FIELD
  ];
  return typeof realClientMsgID === "string" ? realClientMsgID : "";
};

export const compactAgentStreamMessages = (messages: MessageItem[]) => {
  const latestByStream = new Map<string, MessageItem>();
  const output: MessageItem[] = [];

  messages.forEach((message) => {
    const payload = getAgentStreamPayload(message);
    const streamID = payload?.streamID?.trim();
    if (!payload || !streamID) {
      output.push(message);
      return;
    }

    latestByStream.set(streamID, message);
    const existingIndex = output.findIndex((item) => {
      const itemPayload = getAgentStreamPayload(item);
      return itemPayload?.streamID === streamID;
    });
    const existingMessage = existingIndex >= 0 ? output[existingIndex] : undefined;

    const stableMessage = {
      ...message,
      [AGENT_STREAM_REAL_CLIENT_MSG_ID_FIELD]:
        getAgentStreamRealClientMsgID(existingMessage) ||
        getAgentStreamRealClientMsgID(message) ||
        message.clientMsgID,
      clientMsgID: `${AGENT_STREAM_VIRTUAL_ID_PREFIX}${streamID}`,
    };

    if (existingIndex >= 0) {
      output[existingIndex] = stableMessage;
    } else {
      output.push(stableMessage);
    }
  });

  return output.map((message) => {
    const payload = getAgentStreamPayload(message);
    const streamID = payload?.streamID?.trim();
    if (!streamID) return message;
    return {
      ...latestByStream.get(streamID),
      ...message,
      [AGENT_STREAM_REAL_CLIENT_MSG_ID_FIELD]:
        getAgentStreamRealClientMsgID(message) || message.clientMsgID,
      clientMsgID: `${AGENT_STREAM_VIRTUAL_ID_PREFIX}${streamID}`,
    } as MessageItem;
  });
};
