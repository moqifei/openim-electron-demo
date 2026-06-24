import { MessageItem, SessionType, ViewType } from "@openim/wasm-client-sdk";
import { useLatest, useRequest } from "ahooks";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getGroupMessagesReadInfo, markMsgsAsRead } from "@/api/imApi";
import { IMSDK } from "@/layout/MainContentWrap";
import { useUserStore } from "@/store";
import emitter, { emit } from "@/utils/events";

const START_INDEX = 10000;
const SPLIT_COUNT = 20;

const canSendGroupReadReceipt = () => {
  const lib = (IMSDK as any).libOpenIMSDK;
  return typeof lib?.send_group_message_read_receipt === "function";
};

export function useHistoryMessageList() {
  const { conversationID } = useParams();
  const currentUserID = useUserStore((state) => state.selfInfo.userID);
  const [loadState, setLoadState] = useState({
    initLoading: true,
    hasMoreOld: true,
    messageList: [] as MessageItem[],
    firstItemIndex: START_INDEX,
  });
  const latestLoadState = useLatest(loadState);

  useEffect(() => {
    loadHistoryMessages();
    return () => {
      setLoadState(() => ({
        initLoading: true,
        hasMoreOld: true,
        messageList: [] as MessageItem[],
        firstItemIndex: START_INDEX,
      }));
    };
  }, [conversationID]);

  useEffect(() => {
    const pushNewMessage = (message: MessageItem) => {
      if (
        latestLoadState.current.messageList.find(
          (item) => item.clientMsgID === message.clientMsgID,
        )
      ) {
        return;
      }
      setLoadState((preState) => ({
        ...preState,
        messageList: [...preState.messageList, message],
      }));
    };
    const updateOneMessage = (message: MessageItem) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex((msg) => msg.clientMsgID === message.clientMsgID);
        if (idx < 0) {
          return preState;
        }

        tmpList[idx] = {
          ...tmpList[idx],
          ...message,
          attachedInfoElem: {
            ...tmpList[idx].attachedInfoElem,
            ...message.attachedInfoElem,
          },
        };
        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    const reloadChatMessages = () => {
      loadHistoryMessages();
    };
    emitter.on("PUSH_NEW_MSG", pushNewMessage);
    emitter.on("UPDATE_ONE_MSG", updateOneMessage);
    emitter.on("RELOAD_CHAT_MESSAGES", reloadChatMessages);
    return () => {
      emitter.off("PUSH_NEW_MSG", pushNewMessage);
      emitter.off("UPDATE_ONE_MSG", updateOneMessage);
      emitter.off("RELOAD_CHAT_MESSAGES", reloadChatMessages);
    };
  }, []);

  const loadHistoryMessages = () => getMoreOldMessages(false);

  const { loading: moreOldLoading, runAsync: getMoreOldMessages } = useRequest(
    async (loadMore = true) => {
      const reqConversationID = conversationID;
      console.log("[history] getAdvancedHistoryMessageList start", "convID:", conversationID, "loadMore:", loadMore);
      const { data } = await IMSDK.getAdvancedHistoryMessageList({
        count: SPLIT_COUNT,
        startClientMsgID: loadMore
          ? latestLoadState.current.messageList[0]?.clientMsgID
          : "",
        conversationID: conversationID ?? "",
        viewType: ViewType.History,
      });
      if (conversationID !== reqConversationID) return;

      const loadedSeqs = data.messageList.map((m: MessageItem) => m.seq).sort((a: number, b: number) => a - b);
      console.log("[history] getAdvancedHistoryMessageList result",
        "count:", data.messageList.length,
        "isEnd:", data.isEnd,
        "seqRange:", loadedSeqs.length > 0 ? `${loadedSeqs[0]}-${loadedSeqs[loadedSeqs.length-1]}` : "empty",
        "seqs:", loadedSeqs);

      let currentMsgList = loadMore
        ? [...data.messageList, ...latestLoadState.current.messageList]
        : data.messageList;

      const sessionType = data.messageList[0]?.sessionType;
      if (currentMsgList.length > 0 && sessionType === SessionType.Group && reqConversationID) {
        const ownGroupMessages = currentMsgList.filter(
          (msg) => msg.sendID === currentUserID && msg.seq > 0,
        );
        const ownSeqs = ownGroupMessages.map((msg) => msg.seq);
        if (ownSeqs.length > 0) {
          try {
            const groupID = ownGroupMessages[0]?.groupID ?? currentMsgList[0]?.groupID;
            const { data: readInfos } = await getGroupMessagesReadInfo({
              conversationID: reqConversationID,
              groupID,
              userID: currentUserID,
              seqs: ownSeqs,
            });
            const readInfoMap = new Map(readInfos.map((info) => [info.seq, info]));
            currentMsgList = currentMsgList.map((msg) => {
              const readInfo = readInfoMap.get(msg.seq);
              if (!readInfo) return msg;
              return {
                ...msg,
                attachedInfoElem: {
                  ...msg.attachedInfoElem,
                  groupHasReadInfo: {
                    ...msg.attachedInfoElem?.groupHasReadInfo,
                    hasReadCount: readInfo.hasReadCount,
                    unreadCount: readInfo.unreadCount,
                    groupMemberCount: readInfo.groupMemberCount,
                    hasReadUserIDList: readInfo.hasReadUserIDList,
                  },
                },
              };
            });
            console.log("[read] refreshed own group read info:", readInfos);
          } catch (err) {
            console.error("[read] failed to refresh own group read info:", err);
          }
        }
      }

      setTimeout(() =>
        setLoadState((preState) => ({
          ...preState,
          initLoading: false,
          hasMoreOld: !data.isEnd,
          messageList: currentMsgList,
          firstItemIndex: preState.firstItemIndex - data.messageList.length,
        })),
      );

      // 群聊消息：拉取后标记会话已读。当前 native SDK 可能未导出逐消息群回执函数，
      // 因此逐消息回执仅作为可选增强，避免阻断会话已读状态更新。
      console.log("[read] checking group read receipt, sessionType:", sessionType, "msgCount:", currentMsgList.length);
      
      if (currentMsgList.length > 0 && sessionType === SessionType.Group) {
        const unreadMessages = currentMsgList
          .filter((msg) => !msg.isRead && msg.sendID !== currentUserID)
          .filter((msg) => msg.seq > 0);
        const unreadMsgIDs = unreadMessages.map((msg) => msg.clientMsgID);
        const unreadSeqs = unreadMessages
          .map((msg) => msg.seq)
          .sort((a, b) => a - b);
        
        console.log("[read] filtered unread msgIDs:", unreadMsgIDs.length, unreadMsgIDs);
        
        if (unreadMsgIDs.length > 0) {
          if (canSendGroupReadReceipt()) {
            console.log("[read] sending group read receipt for", unreadMsgIDs.length, "messages");
            IMSDK.sendGroupMessageReadReceipt({
              conversationID: reqConversationID,
              clientMsgIDList: unreadMsgIDs,
            }).then(() => {
              console.log("[read] group read receipt sent successfully");
            }).catch((err) => {
              console.error("[read] failed to send group read receipt:", err);
            });
          } else {
            if (!reqConversationID) return;
            console.warn("[read] native group read receipt is unavailable, using mark_msgs_as_read fallback");
            markMsgsAsRead({
              conversationID: reqConversationID,
              seqs: unreadSeqs,
              userID: currentUserID,
            }).then(() => {
              console.log("[read] mark_msgs_as_read fallback sent successfully");
            }).catch((err) => {
              console.error("[read] failed to send mark_msgs_as_read fallback:", err);
            });
          }
        } else {
          console.log("[read] no unread messages to send receipt for");
        }
      } else {
        console.log("[read] skipping group read receipt: not a group conversation or no messages");
      }
    },
    {
      manual: true,
    },
  );

  return {
    SPLIT_COUNT,
    loadState,
    latestLoadState,
    conversationID,
    moreOldLoading,
    getMoreOldMessages,
  };
}

export const pushNewMessage = (message: MessageItem) => emit("PUSH_NEW_MSG", message);
export const updateOneMessage = (message: MessageItem) =>
  emit("UPDATE_ONE_MSG", message);
