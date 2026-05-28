import {
  MessageItem as MessageItemType,
  MessageType,
  SessionType,
} from "@openim/wasm-client-sdk";
import { Layout, Spin, message as antdMessage } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { IMSDK } from "@/layout/MainContentWrap";
import { SystemMessageTypes } from "@/constants/im";
import { useConversationStore, useUserStore } from "@/store";
import emitter from "@/utils/events";
import { feedbackToast } from "@/utils/common";

import ForwardModal, { ForwardModalHandle } from "./ForwardModal";
import MessageItem from "./MessageItem";
import MultiSelectToolbar from "./MultiSelectToolbar";
import NotificationMessage from "./NotificationMessage";
import { useHistoryMessageList } from "./useHistoryMessageList";

const ChatContent = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const forwardModalRef = useRef<ForwardModalHandle>(null);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const setQuoteMessage = useConversationStore((state) => state.setQuoteMessage);

  const [multiSelectState, setMultiSelectState] = useState<{
    isActive: boolean;
    selectedIds: Set<string>;
  }>({ isActive: false, selectedIds: new Set() });

  const scrollToBottom = () => {
    setTimeout(() => {
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const { SPLIT_COUNT, conversationID, loadState, moreOldLoading, getMoreOldMessages } =
    useHistoryMessageList();

  useEffect(() => {
    emitter.on("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    return () => {
      emitter.off("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    };
  }, []);

  // Clear multi-select when conversation changes
  useEffect(() => {
    setMultiSelectState({ isActive: false, selectedIds: new Set() });
  }, [conversationID]);

  const loadMoreMessage = () => {
    if (!loadState.hasMoreOld || moreOldLoading) return;
    getMoreOldMessages();
  };

  const selectedMessages = loadState.messageList.filter((m) =>
    multiSelectState.selectedIds.has(m.clientMsgID),
  );

  const handleToggleSelect = useCallback((clientMsgID: string) => {
    setMultiSelectState((prev) => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(clientMsgID)) {
        newSet.delete(clientMsgID);
      } else {
        if (newSet.size >= 50) {
          antdMessage.warning(t("toast.beyondSelectionLimit"));
          return prev;
        }
        newSet.add(clientMsgID);
      }
      return { ...prev, selectedIds: newSet };
    });
  }, []);

  const handleForward = useCallback(
    (messages: MessageItemType[], isMerge: boolean) => {
      if (!messages.length) return;
      forwardModalRef.current?.openModal(async (targets) => {
        for (const target of targets) {
          const recvID = target.userID || "";
          const groupID = target.groupID || "";
          try {
            if (isMerge && messages.length > 1) {
              const title =
                currentConversation?.groupID
                  ? t("placeholder.messageHistory")
                  : t("placeholder.whosMessageHistory", {
                      who: currentConversation?.showName || "",
                    });
              const summaryList = messages.slice(0, 2).map((m) => {
                const sender = m.senderNickname || "";
                let content = "";
                switch (m.contentType) {
                  case MessageType.TextMessage:
                    content = m.textElem?.content || "";
                    break;
                  case MessageType.PictureMessage:
                    content = t("messageDescription.imageMessage");
                    break;
                  case MessageType.FileMessage:
                    content = t("messageDescription.fileMessage", { file: m.fileElem?.fileName || "" });
                    break;
                  case MessageType.CardMessage:
                    content = t("messageDescription.cardMessage");
                    break;
                  case MessageType.MergeMessage:
                    content = m.mergeElem?.title || t("messageDescription.mergeMessage");
                    break;
                  case MessageType.QuoteMessage: {
                    const quoted = m.quoteElem?.quoteMessage;
                    let quotedContent = "";
                    if (quoted) {
                      switch (quoted.contentType) {
                        case MessageType.TextMessage:
                          quotedContent = quoted.textElem?.content || "";
                          break;
                        case MessageType.PictureMessage:
                          quotedContent = t("messageDescription.imageMessage");
                          break;
                        case MessageType.FileMessage:
                          quotedContent = t("messageDescription.fileMessage", { file: quoted.fileElem?.fileName || "" });
                          break;
                        default:
                          quotedContent = t("messageDescription.catchMessage");
                      }
                    }
                    content = `${t("messageDescription.quoteMessage")}${quotedContent ? " " + quotedContent : ""}`;
                    break;
                  }
                  default:
                    content = t("messageDescription.catchMessage");
                }
                return `${sender}: ${content}`;
              });
              const { data: mergeMsg } = await IMSDK.createMergerMessage({
                messageList: messages,
                title,
                summaryList,
              });
              await IMSDK.sendMessage({ recvID, groupID, message: mergeMsg });
            } else {
              for (const msg of messages) {
                const { data: forwardMsg } = await IMSDK.createForwardMessage(msg);
                await IMSDK.sendMessage({ recvID, groupID, message: forwardMsg });
              }
            }
          } catch (error) {
            feedbackToast({ error });
          }
        }
        antdMessage.success(t("toast.sendSuccess"));
        if (isMerge) {
          setMultiSelectState({ isActive: false, selectedIds: new Set() });
        }
      });
    },
    [currentConversation],
  );

  const handleReply = useCallback(
    (msg: MessageItemType) => {
      setQuoteMessage(msg);
    },
    [setQuoteMessage],
  );

  const handleMultiSelect = useCallback((msg: MessageItemType) => {
    setMultiSelectState({
      isActive: true,
      selectedIds: new Set([msg.clientMsgID]),
    });
  }, []);

  const handleDelete = useCallback(
    async (msg: MessageItemType) => {
      if (!conversationID) return;
      try {
        await IMSDK.deleteMessage({
          conversationID,
          clientMsgID: msg.clientMsgID,
        });
      } catch (error) {
        feedbackToast({ error });
      }
    },
    [conversationID],
  );

  const handleForwardOneByOne = useCallback(() => {
    handleForward(selectedMessages, false);
  }, [selectedMessages, handleForward]);

  const handleMergeForward = useCallback(() => {
    handleForward(selectedMessages, true);
  }, [selectedMessages, handleForward]);

  const cancelMultiSelect = useCallback(() => {
    setMultiSelectState({ isActive: false, selectedIds: new Set() });
  }, []);

  return (
    <Layout.Content
      className="relative flex h-full overflow-hidden !bg-white"
      id="chat-main"
    >
      {loadState.initLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-white pt-1">
          <Spin spinning />
        </div>
      ) : (
        <Virtuoso
          id="chat-list"
          className="w-full overflow-x-hidden"
          followOutput="smooth"
          firstItemIndex={loadState.firstItemIndex}
          initialTopMostItemIndex={SPLIT_COUNT - 1}
          startReached={loadMoreMessage}
          ref={virtuoso}
          data={loadState.messageList}
          components={{
            Header: () =>
              loadState.hasMoreOld ? (
                <div
                  className={clsx(
                    "flex justify-center py-2 opacity-0",
                    moreOldLoading && "opacity-100",
                  )}
                >
                  <Spin />
                </div>
              ) : null,
          }}
          computeItemKey={(_, item) => item.clientMsgID}
          itemContent={(_, message) => {
            if (SystemMessageTypes.includes(message.contentType)) {
              return (
                <NotificationMessage key={message.clientMsgID} message={message} />
              );
            }
            const isSender = selfUserID === message.sendID;
            return (
              <MessageItem
                key={message.clientMsgID}
                conversationID={conversationID}
                message={message}
                messageUpdateFlag={message.senderNickname + message.senderFaceUrl}
                isSender={isSender}
                isMultiSelectActive={multiSelectState.isActive}
                isSelected={multiSelectState.selectedIds.has(message.clientMsgID)}
                onToggleSelect={handleToggleSelect}
                onForward={(msg) => handleForward([msg], false)}
                onReply={handleReply}
                onMultiSelect={handleMultiSelect}
                onDelete={handleDelete}
              />
            );
          }}
        />
      )}

      {multiSelectState.isActive && (
        <MultiSelectToolbar
          selectedMessages={selectedMessages}
          onForwardOneByOne={handleForwardOneByOne}
          onMergeForward={handleMergeForward}
          onCopy={cancelMultiSelect}
          onSave={cancelMultiSelect}
          onFavorite={cancelMultiSelect}
          onCancel={cancelMultiSelect}
        />
      )}

      <ForwardModal ref={forwardModalRef} />
    </Layout.Content>
  );
};

export default memo(ChatContent);
