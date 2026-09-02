import { MessageItem, SessionType, ViewType } from "@openim/wasm-client-sdk";
import { useLatest, useRequest } from "ahooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { getGroupMessagesReadInfo, markMsgsAsRead } from "@/api/imApi";
import { IMSDK } from "@/layout/MainContentWrap";
import { useUserStore } from "@/store";
import {
  compactAgentStreamMessages,
  getAgentStreamRealClientMsgID,
} from "@/utils/agentStreamMessage";
import emitter, { emit } from "@/utils/events";

const START_INDEX = 10000;
const SPLIT_COUNT = 20;

export type MessageLocation = {
  messageIndex: number;
  firstItemIndex: number;
  clientMsgID: string;
};

const canSendGroupReadReceipt = () => {
  const lib = (IMSDK as any).libOpenIMSDK;
  return typeof lib?.send_group_message_read_receipt === "function";
};

const getHistoryStartClientMsgID = (messages: MessageItem[]) => {
  for (const message of messages) {
    const clientMsgID = getAgentStreamRealClientMsgID(message);
    if (clientMsgID) return clientMsgID;
  }
  return "";
};

const mergeMessageList = (current: MessageItem[], incoming: MessageItem[]) => {
  const messageMap = new Map(current.map((message) => [message.clientMsgID, message]));
  incoming.forEach((message) => {
    if (message.clientMsgID) messageMap.set(message.clientMsgID, message);
  });
  return [...messageMap.values()].sort(
    (left, right) => left.sendTime - right.sendTime || left.seq - right.seq,
  );
};

const getMessageIdentifiers = (message: MessageItem) =>
  [
    message.clientMsgID,
    getAgentStreamRealClientMsgID(message),
    message.serverMsgID,
  ].filter(Boolean);

const isSameMessage = (left: MessageItem, right: MessageItem) => {
  if (left.seq > 0 && right.seq > 0 && left.seq === right.seq) {
    return true;
  }

  const rightIdentifiers = new Set(getMessageIdentifiers(right));
  return getMessageIdentifiers(left).some((identifier) =>
    rightIdentifiers.has(identifier),
  );
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
  // Shared handle so the message-push handler can trigger an immediate seq
  // resolution for freshly-sent group messages (instead of waiting for the
  // next poll tick).
  const resolvePendingSeqsRef = useRef<() => void>();

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
      const existingIdx = latestLoadState.current.messageList.findIndex(
        (item) => item.clientMsgID === message.clientMsgID,
      );
      // When the server echoes back a message we just sent (same clientMsgID),
      // merge server-assigned fields (especially `seq`) into our local copy.
      // Without this, locally-sent messages keep seq=0 forever and are never
      // picked up by the group-read polling filter (m.seq > 0), so their
      // @-mention dots never update in real time.
      if (existingIdx >= 0) {
        const existing = latestLoadState.current.messageList[existingIdx];
        // Only merge if server has assigned a real seq and we don't have one yet
        if (message.seq > 0 && existing.seq === 0) {
          console.log(
            "[pushNewMessage] merging server echo for clientMsgID:",
            message.clientMsgID,
            "seq: 0 ->",
            message.seq,
          );
          updateOneMessage({
            clientMsgID: message.clientMsgID,
            seq: message.seq,
            serverMsgID: message.serverMsgID,
            status: message.status,
          } as MessageItem);
        }
        return;
      }
      setLoadState((preState) => ({
        ...preState,
        messageList: compactAgentStreamMessages([...preState.messageList, message]),
      }));
      // A freshly-sent group message starts at seq===0. Trigger an immediate
      // seq resolution so its @-mention dot can update in real time without
      // waiting for the next poll tick. setTimeout lets the state flush first.
      if (message.sendID === currentUserID && message.seq === 0 && message.groupID) {
        setTimeout(() => resolvePendingSeqsRef.current?.(), 0);
      }
    };
    const updateOneMessage = (message: MessageItem) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex(
          (msg) =>
            msg.clientMsgID === message.clientMsgID ||
            getAgentStreamRealClientMsgID(msg) === message.clientMsgID,
        );
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
          messageList: compactAgentStreamMessages(tmpList),
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

  // ── Real-time poll for own group messages' read status ──────────────
  // The SDK's OnRecvGroupReadReceipt callback does NOT fire reliably when
  // a message is read on another client (e.g. the web app), so the
  // groupHasReadInfo.hasReadUserIDList never updates in real time.  We
  // therefore poll getGroupMessagesReadInfo on an interval for the
  // messages THIS user sent, and push updates to drive the @-mention dot
  // solid in real time — no conversation switch required.
  //
  // IMPORTANT: locally-sent group messages start out with seq===0. The
  // server only assigns the real seq once the message is persisted, and in
  // this build the send callback's successMessage still carries seq===0.
  // Because the polling below filters on `seq > 0`, those messages would
  // never be polled and their @-mention dots would never update in place —
  // which is exactly why switching chats "fixes" it (a history reload brings
  // back the real seq). `resolvePendingSeqs` closes that gap: it matches the
  // seq===0 message against the latest history (by clientMsgID) to recover
  // the real seq, then immediately fetches its read info.
  useEffect(() => {
    if (!conversationID || !conversationID.startsWith("sg_")) return;
    let cancelled = false;
    const POLL_INTERVAL = 4000;
    let lastSeqResolve = 0;

    // Recover the server-assigned seq for any own group message still at
    // seq===0, then fetch its read info right away.
    const resolvePendingSeqs = async () => {
      const list = latestLoadState.current.messageList;
      const pending = list.filter((m) => m.sendID === currentUserID && m.seq === 0);
      if (pending.length === 0) return;
      try {
        const { data } = await IMSDK.getAdvancedHistoryMessageList({
          count: SPLIT_COUNT,
          startClientMsgID: "",
          conversationID: conversationID ?? "",
          viewType: ViewType.History,
        });
        if (cancelled) return;
        const byClientID = new Map(data.messageList.map((m) => [m.clientMsgID, m]));
        const resolved = pending
          .map((m) => byClientID.get(m.clientMsgID))
          .filter((m): m is MessageItem => Boolean(m) && m!.seq > 0);
        if (resolved.length === 0) return;

        // Merge the real seq so the polling below picks it up next tick.
        resolved.forEach((m) => {
          updateOneMessage({
            clientMsgID: m.clientMsgID,
            seq: m.seq,
            serverMsgID: m.serverMsgID,
            status: m.status,
          } as MessageItem);
        });

        // Fetch read info immediately so the dot can flip without waiting
        // for the next poll cycle.
        const groupID = resolved[0].groupID ?? list.find((m) => m.groupID)?.groupID;
        const { data: readInfos } = await getGroupMessagesReadInfo({
          conversationID: conversationID ?? "",
          groupID,
          userID: currentUserID,
          seqs: resolved.map((m) => m.seq),
        });
        if (cancelled) return;
        const readInfoMap = new Map(readInfos.map((info) => [info.seq, info]));
        resolved.forEach((m) => {
          const info = readInfoMap.get(m.seq);
          if (!info) return;
          updateOneMessage({
            clientMsgID: m.clientMsgID,
            attachedInfoElem: {
              groupHasReadInfo: {
                hasReadCount: info.hasReadCount,
                unreadCount: info.unreadCount,
                groupMemberCount: info.groupMemberCount,
                hasReadUserIDList: info.hasReadUserIDList ?? [],
              },
            },
          } as MessageItem);
        });
        console.log(
          "[poll] resolved seq + read info for",
          resolved.length,
          "pending message(s)",
        );
      } catch (err) {
        // Resolution failure should not affect the main flow
      }
    };
    resolvePendingSeqsRef.current = resolvePendingSeqs;

    const poll = async () => {
      if (cancelled) return;
      const list = latestLoadState.current.messageList;

      // Resolve any locally-sent message that still lacks a real seq so it
      // can be included in the read-info polling below.
      if (list.some((m) => m.sendID === currentUserID && m.seq === 0)) {
        const now = Date.now();
        if (now - lastSeqResolve > 3000) {
          lastSeqResolve = now;
          resolvePendingSeqs();
        }
      }

      const ownSeqs = list
        .filter((m) => m.sendID === currentUserID && m.seq > 0)
        .map((m) => m.seq);
      if (ownSeqs.length === 0) return;
      const groupID = list.find((m) => m.groupID)?.groupID;
      try {
        const { data: readInfos } = await getGroupMessagesReadInfo({
          conversationID,
          groupID,
          userID: currentUserID,
          seqs: ownSeqs,
        });
        if (cancelled) return;
        const readInfoMap = new Map(readInfos.map((info) => [info.seq, info]));
        list.forEach((msg) => {
          const info = readInfoMap.get(msg.seq);
          if (!info) return;
          const next = info.hasReadUserIDList ?? [];
          const prev = msg.attachedInfoElem?.groupHasReadInfo?.hasReadUserIDList ?? [];
          // Only log when there's an actual change (helps diagnose real-time updates)
          if (next.join(",") !== prev.join(",")) {
            console.log(
              "[poll] seq:",
              msg.seq,
              "readers changed:",
              prev.length === 0 ? "(none)" : prev,
              "->",
              next,
            );
          }
          updateOneMessage({
            clientMsgID: msg.clientMsgID,
            attachedInfoElem: {
              groupHasReadInfo: {
                hasReadCount: info.hasReadCount,
                unreadCount: info.unreadCount,
                groupMemberCount: info.groupMemberCount,
                hasReadUserIDList: next,
              },
            },
          } as MessageItem);
        });
      } catch (err) {
        // Polling failure should not affect main flow
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationID]);

  const loadHistoryMessages = () => getMoreOldMessages(false);

  const { loading: moreOldLoading, runAsync: getMoreOldMessages } = useRequest(
    async (loadMore = true) => {
      const reqConversationID = conversationID;
      console.log(
        "[history] getAdvancedHistoryMessageList start",
        "convID:",
        conversationID,
        "loadMore:",
        loadMore,
      );
      const { data } = await IMSDK.getAdvancedHistoryMessageList({
        count: SPLIT_COUNT,
        startClientMsgID: loadMore
          ? getHistoryStartClientMsgID(latestLoadState.current.messageList)
          : "",
        conversationID: conversationID ?? "",
        viewType: ViewType.History,
      });
      if (conversationID !== reqConversationID) return;

      const loadedSeqs = data.messageList
        .map((m: MessageItem) => m.seq)
        .sort((a: number, b: number) => a - b);
      console.log(
        "[history] getAdvancedHistoryMessageList result",
        "count:",
        data.messageList.length,
        "isEnd:",
        data.isEnd,
        "seqRange:",
        loadedSeqs.length > 0
          ? `${loadedSeqs[0]}-${loadedSeqs[loadedSeqs.length - 1]}`
          : "empty",
        "seqs:",
        loadedSeqs,
      );

      let currentMsgList = loadMore
        ? [...data.messageList, ...latestLoadState.current.messageList]
        : data.messageList;

      const sessionType = data.messageList[0]?.sessionType;
      if (
        currentMsgList.length > 0 &&
        sessionType === SessionType.Group &&
        reqConversationID
      ) {
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
          messageList: compactAgentStreamMessages(currentMsgList),
          firstItemIndex: preState.firstItemIndex - data.messageList.length,
        })),
      );

      // 群聊消息：拉取后标记会话已读。当前 native SDK 可能未导出逐消息群回执函数，
      // 因此逐消息回执仅作为可选增强，避免阻断会话已读状态更新。
      console.log(
        "[read] checking group read receipt, sessionType:",
        sessionType,
        "msgCount:",
        currentMsgList.length,
      );

      if (currentMsgList.length > 0 && sessionType === SessionType.Group) {
        const unreadMessages = currentMsgList
          .filter((msg) => !msg.isRead && msg.sendID !== currentUserID)
          .filter((msg) => msg.seq > 0);
        const unreadMsgIDs = unreadMessages.map((msg) => msg.clientMsgID);
        const unreadSeqs = unreadMessages.map((msg) => msg.seq).sort((a, b) => a - b);

        console.log(
          "[read] filtered unread msgIDs:",
          unreadMsgIDs.length,
          unreadMsgIDs,
        );

        if (unreadMsgIDs.length > 0) {
          if (canSendGroupReadReceipt()) {
            console.log(
              "[read] sending group read receipt for",
              unreadMsgIDs.length,
              "messages",
            );
            IMSDK.sendGroupMessageReadReceipt({
              conversationID: reqConversationID,
              clientMsgIDList: unreadMsgIDs,
            })
              .then(() => {
                console.log("[read] group read receipt sent successfully");
              })
              .catch((err) => {
                console.error("[read] failed to send group read receipt:", err);
              });
          } else {
            if (!reqConversationID) return;
            console.warn(
              "[read] native group read receipt is unavailable, using mark_msgs_as_read fallback",
            );
            markMsgsAsRead({
              conversationID: reqConversationID,
              seqs: unreadSeqs,
              userID: currentUserID,
            })
              .then(() => {
                console.log("[read] mark_msgs_as_read fallback sent successfully");
              })
              .catch((err) => {
                console.error("[read] failed to send mark_msgs_as_read fallback:", err);
              });
          }
        } else {
          console.log("[read] no unread messages to send receipt for");
        }
      } else {
        console.log(
          "[read] skipping group read receipt: not a group conversation or no messages",
        );
      }

      return data;
    },
    {
      manual: true,
    },
  );
  const latestMoreOldLoading = useLatest(moreOldLoading);

  const findMessageAndLoad = useCallback(
    async (targetMessage: MessageItem): Promise<MessageLocation | null> => {
      const clientMsgID = targetMessage.clientMsgID;
      if (!clientMsgID && targetMessage.seq <= 0) {
        if (import.meta.env.DEV) {
          console.info("[history-location] missing-identifier", {
            clientMsgID,
            serverMsgID: targetMessage.serverMsgID,
            seq: targetMessage.seq,
          });
        }
        return null;
      }

      if (import.meta.env.DEV) {
        console.info("[history-location] start", {
          conversationID,
          clientMsgID,
          serverMsgID: targetMessage.serverMsgID,
          seq: targetMessage.seq,
          loadedCount: latestLoadState.current.messageList.length,
          hasMoreOld: latestLoadState.current.hasMoreOld,
        });
      }

      let hasMoreOld = true;
      while (hasMoreOld) {
        const currentLoadState = latestLoadState.current;
        if (!currentLoadState) return null;
        const messageIndex = currentLoadState.messageList.findIndex((message) =>
          isSameMessage(message, targetMessage),
        );
        if (messageIndex >= 0) {
          if (import.meta.env.DEV) {
            console.info("[history-location] loaded-match", {
              messageIndex,
              firstItemIndex: currentLoadState.firstItemIndex,
              clientMsgID: currentLoadState.messageList[messageIndex].clientMsgID,
            });
          }
          return {
            messageIndex,
            firstItemIndex: currentLoadState.firstItemIndex,
            clientMsgID: currentLoadState.messageList[messageIndex].clientMsgID,
          };
        }

        const realClientMsgID = getAgentStreamRealClientMsgID(targetMessage);
        const resolvedTargetMessage = realClientMsgID
          ? { ...targetMessage, clientMsgID: realClientMsgID }
          : targetMessage;
        try {
          const lookupClientMsgIDs = [resolvedTargetMessage.clientMsgID].filter(
            Boolean,
          );
          if (conversationID && lookupClientMsgIDs.length > 0) {
            const response = await IMSDK.findMessageList([
              {
                conversationID,
                clientMsgIDList: lookupClientMsgIDs,
              },
            ]);
            const result = response.data as unknown;
            const data = Array.isArray(result)
              ? (result as MessageItem[])
              : (
                  result as {
                    findResultItems?: { messageList?: MessageItem[] }[];
                  }
                ).findResultItems?.flatMap((item) => item.messageList || []) ?? [];
            const storedMessage = data.find((message) =>
              isSameMessage(message, resolvedTargetMessage),
            );
            if (import.meta.env.DEV) {
              console.info("[history-location] local-result", {
                responseType: Array.isArray(result) ? "array" : "find-result-items",
                messageCount: data.length,
                matched: Boolean(storedMessage),
              });
            }
            if (storedMessage) {
              const mergedMessages = mergeMessageList(currentLoadState.messageList, [
                storedMessage,
              ]);
              const nextMessageList = compactAgentStreamMessages(mergedMessages);
              const firstExistingID = currentLoadState.messageList[0]?.clientMsgID;
              const firstExistingIndex = firstExistingID
                ? nextMessageList.findIndex(
                    (message) => message.clientMsgID === firstExistingID,
                  )
                : 0;
              setLoadState((preState) => ({
                ...preState,
                initLoading: false,
                messageList: nextMessageList,
                firstItemIndex: preState.firstItemIndex - firstExistingIndex,
              }));
              for (let attempt = 0; attempt < 20; attempt += 1) {
                const nextState = latestLoadState.current;
                const nextMessageIndex = nextState.messageList.findIndex((message) =>
                  isSameMessage(message, storedMessage),
                );
                if (nextMessageIndex >= 0) {
                  return {
                    messageIndex: nextMessageIndex,
                    firstItemIndex: nextState.firstItemIndex,
                    clientMsgID: nextState.messageList[nextMessageIndex].clientMsgID,
                  };
                }
                await new Promise<void>((resolve) => setTimeout(resolve, 16));
              }
              return null;
            }
          }
        } catch (error) {
          console.warn("[history] failed to find quoted message by id:", error);
        }

        try {
          const { data } = await IMSDK.fetchSurroundingMessages({
            startMessage: resolvedTargetMessage,
            viewType: ViewType.History,
            before: SPLIT_COUNT,
            after: SPLIT_COUNT,
          });
          const surroundingMessages = data.messageList ?? [];
          const hasSurroundingTarget = surroundingMessages.some((message) =>
            isSameMessage(message, resolvedTargetMessage),
          );
          if (import.meta.env.DEV) {
            console.info("[history-location] surrounding-result", {
              messageCount: surroundingMessages.length,
              matched: hasSurroundingTarget,
            });
          }
          if (hasSurroundingTarget) {
            const mergedMessages = mergeMessageList(
              currentLoadState.messageList,
              surroundingMessages,
            );
            const nextMessageList = compactAgentStreamMessages(mergedMessages);
            const firstExistingID = currentLoadState.messageList[0]?.clientMsgID;
            const firstExistingIndex = firstExistingID
              ? nextMessageList.findIndex(
                  (message) => message.clientMsgID === firstExistingID,
                )
              : 0;
            setLoadState((preState) => ({
              ...preState,
              initLoading: false,
              messageList: nextMessageList,
              firstItemIndex: preState.firstItemIndex - firstExistingIndex,
            }));
            for (let attempt = 0; attempt < 20; attempt += 1) {
              const nextState = latestLoadState.current;
              const nextMessageIndex = nextState.messageList.findIndex((message) =>
                isSameMessage(message, targetMessage),
              );
              if (nextMessageIndex >= 0) {
                return {
                  messageIndex: nextMessageIndex,
                  firstItemIndex: nextState.firstItemIndex,
                  clientMsgID: nextState.messageList[nextMessageIndex].clientMsgID,
                };
              }
              await new Promise<void>((resolve) => setTimeout(resolve, 16));
            }
            return null;
          }
        } catch (error) {
          console.warn("[history] failed to fetch surrounding messages:", error);
        }

        hasMoreOld = currentLoadState.hasMoreOld;
        if (!hasMoreOld) {
          if (import.meta.env.DEV) {
            console.info("[history-location] end-of-history", {
              loadedCount: currentLoadState.messageList.length,
            });
          }
          return null;
        }

        for (
          let attempt = 0;
          latestMoreOldLoading.current && attempt < 60;
          attempt += 1
        ) {
          await new Promise<void>((resolve) => setTimeout(resolve, 16));
        }
        if (latestMoreOldLoading.current) return null;

        const previousLength = currentLoadState.messageList.length;
        try {
          const result = await getMoreOldMessages();
          if (import.meta.env.DEV) {
            console.info("[history-location] page-result", {
              messageCount: result?.messageList?.length ?? 0,
              isEnd: result?.isEnd,
            });
          }
          if (!result?.messageList?.length) {
            return null;
          }
        } catch (error) {
          console.error("[history] failed to load messages for jump:", error);
          return null;
        }

        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (
            latestLoadState.current &&
            latestLoadState.current.messageList.length > previousLength
          ) {
            break;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 16));
        }
        if (
          !latestLoadState.current ||
          latestLoadState.current.messageList.length === previousLength
        ) {
          return null;
        }
      }

      return null;
    },
    [getMoreOldMessages, latestLoadState, latestMoreOldLoading],
  );

  return {
    SPLIT_COUNT,
    loadState,
    latestLoadState,
    conversationID,
    moreOldLoading,
    getMoreOldMessages,
    findMessageAndLoad,
  };
}

export const pushNewMessage = (message: MessageItem) => emit("PUSH_NEW_MSG", message);
export const updateOneMessage = (message: MessageItem) =>
  emit("UPDATE_ONE_MSG", message);
