import { MessageReceiveOptType } from "@openim/wasm-client-sdk";

export const isConversationDoNotDisturb = (conversation?: {
  recvMsgOpt?: MessageReceiveOptType;
}) => conversation?.recvMsgOpt === MessageReceiveOptType.NotNotify;
