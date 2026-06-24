import { MessageStatus, MessageType } from "@openim/wasm-client-sdk";
import { MessageItem, WsResponse } from "@openim/wasm-client-sdk/lib/types/entity";
import { SendMsgParams } from "@openim/wasm-client-sdk/lib/types/params";
import { useCallback } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { emit } from "@/utils/events";

import { pushNewMessage, updateOneMessage } from "../useHistoryMessageList";

export type SendMessageParams = Partial<Omit<SendMsgParams, "message">> & {
  message: MessageItem;
  needPush?: boolean;
};

const isRemoteObjectURL = (url?: string) =>
  Boolean(url && (/^https?:\/\//.test(url) || url.startsWith("/object/")));

const isPreUploadedMediaMessage = (message: MessageItem) => {
  if (message.contentType === MessageType.PictureMessage) {
    return isRemoteObjectURL(message.pictureElem?.sourcePicture?.url);
  }
  if (message.contentType === MessageType.FileMessage) {
    return isRemoteObjectURL(message.fileElem?.sourceUrl);
  }
  return false;
};

export function useSendMessage() {
  const sendMessage = useCallback(
    async ({ recvID, groupID, message, needPush }: SendMessageParams) => {
      const currentConversation = useConversationStore.getState().currentConversation;
      const sourceID = recvID || groupID;
      const inCurrentConversation =
        currentConversation?.userID === sourceID ||
        currentConversation?.groupID === sourceID ||
        !sourceID;
      needPush = needPush ?? inCurrentConversation;

      if (needPush) {
        pushNewMessage(message);
        emit("CHAT_LIST_SCROLL_TO_BOTTOM");
      }

      const options = {
        recvID: recvID ?? currentConversation?.userID ?? "",
        groupID: groupID ?? currentConversation?.groupID ?? "",
        message,
      };

      try {
        const send = isPreUploadedMediaMessage(message)
          ? IMSDK.sendMessageNotOss
          : IMSDK.sendMessage;
        const { data: successMessage } = await send(options);
        updateOneMessage(successMessage);
      } catch (error) {
        updateOneMessage({
          ...message,
          status: MessageStatus.Failed,
        });
      }
    },
    [],
  );

  return {
    sendMessage,
  };
}
