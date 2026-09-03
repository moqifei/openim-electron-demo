import { DownloadOutlined, SaveOutlined } from "@ant-design/icons";
import {
  MessageItem as MessageItemType,
  MessageType,
  SessionType,
} from "@openim/wasm-client-sdk";
import { Image, Layout, message as antdMessage, Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { SystemMessageTypes } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { inferDownloadFileName } from "@/utils/downloadFileName";
import emitter from "@/utils/events";
import { downloadFileWithProgress } from "@/utils/fileDownload";
import { isShakeMessageData } from "@/utils/shakeMessage";

import ForwardModal, { ForwardModalHandle } from "./ForwardModal";
import MessageItem from "./MessageItem";
import MultiSelectToolbar from "./MultiSelectToolbar";
import NotificationMessage from "./NotificationMessage";
import TimeDivider from "./TimeDivider";
import { updateOneMessage, useHistoryMessageList } from "./useHistoryMessageList";

// 与上一条消息间隔超过该值（毫秒）则显示时间分割线
const TIME_DIVIDER_GAP = 10 * 60 * 1000;
const HISTORY_JUMP_SETTLE_DELAY = 300;

const ChatContent = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const stickyScrollFrame = useRef<number>();
  const bottomScrollTimer = useRef<number>();
  const historyJumpUnlockTimer = useRef<number>();
  const pauseStickyScroll = useRef(false);
  const isUserViewingHistory = useRef(false);
  const isAtBottom = useRef(false);
  const touchStartY = useRef<number>();
  const pendingJumpClientMsgID = useRef<string>();
  const historyJumpTargetRendered = useRef(false);
  const forwardModalRef = useRef<ForwardModalHandle>(null);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const setQuoteMessage = useConversationStore((state) => state.setQuoteMessage);

  const [multiSelectState, setMultiSelectState] = useState<{
    isActive: boolean;
    selectedIds: Set<string>;
  }>({ isActive: false, selectedIds: new Set() });
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewMessageID, setImagePreviewMessageID] = useState("");
  const isHistoryJumpingRef = useRef(false);

  const scrollToBottom = () => {
    if (isHistoryJumpingRef.current) return;
    isUserViewingHistory.current = false;
    pauseStickyScroll.current = false;
    if (bottomScrollTimer.current) {
      window.clearTimeout(bottomScrollTimer.current);
    }
    bottomScrollTimer.current = window.setTimeout(() => {
      bottomScrollTimer.current = undefined;
      if (isHistoryJumpingRef.current) return;
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const stickToBottomIfNeeded = () => {
    if (isHistoryJumpingRef.current) return;
    if (pauseStickyScroll.current) return;

    const chatList = document.getElementById("chat-list");
    const distanceToBottom = chatList
      ? chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight
      : 0;

    if (distanceToBottom > 120) return;

    if (stickyScrollFrame.current) {
      window.cancelAnimationFrame(stickyScrollFrame.current);
    }
    stickyScrollFrame.current = window.requestAnimationFrame(() => {
      stickyScrollFrame.current = undefined;
      if (isHistoryJumpingRef.current) return;
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const handleChatWheel = (event: React.WheelEvent) => {
    if (event.deltaY < 0) {
      isUserViewingHistory.current = true;
      pauseStickyScroll.current = true;
    }
  };

  const handleChatScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom <= 4 && isUserViewingHistory.current) {
      isUserViewingHistory.current = false;
      pauseStickyScroll.current = false;
    }
  };

  const handleChatTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY;
  };

  const handleChatTouchMove = (event: React.TouchEvent) => {
    const startY = touchStartY.current;
    const currentY = event.touches[0]?.clientY;
    if (startY === undefined || currentY === undefined) return;
    if (currentY - startY > 8) {
      isUserViewingHistory.current = true;
      pauseStickyScroll.current = true;
    }
  };

  const {
    SPLIT_COUNT,
    conversationID,
    loadState,
    moreOldLoading,
    getMoreOldMessages,
    findMessageAndLoad,
  } = useHistoryMessageList();
  const moreOldLoadingRef = useRef(moreOldLoading);
  moreOldLoadingRef.current = moreOldLoading;

  const scheduleHistoryJumpUnlock = useCallback((clientMsgID: string) => {
    if (historyJumpUnlockTimer.current) {
      window.clearTimeout(historyJumpUnlockTimer.current);
    }
    historyJumpUnlockTimer.current = window.setTimeout(() => {
      historyJumpUnlockTimer.current = undefined;
      if (pendingJumpClientMsgID.current !== clientMsgID || moreOldLoadingRef.current) {
        return;
      }
      pendingJumpClientMsgID.current = undefined;
      historyJumpTargetRendered.current = false;
      isHistoryJumpingRef.current = false;
    }, HISTORY_JUMP_SETTLE_DELAY);
  }, []);

  useEffect(() => {
    if (moreOldLoading || !historyJumpTargetRendered.current) return;
    const clientMsgID = pendingJumpClientMsgID.current;
    if (clientMsgID) scheduleHistoryJumpUnlock(clientMsgID);
  }, [moreOldLoading, scheduleHistoryJumpUnlock]);

  const jumpToMessage = useCallback(
    async (message: MessageItemType) => {
      try {
        if (!message.clientMsgID && message.seq <= 0) {
          feedbackToast({ error: new Error(t("toast.messageLocationFailed")) });
          return;
        }
        if (bottomScrollTimer.current) {
          window.clearTimeout(bottomScrollTimer.current);
          bottomScrollTimer.current = undefined;
        }
        if (stickyScrollFrame.current) {
          window.cancelAnimationFrame(stickyScrollFrame.current);
          stickyScrollFrame.current = undefined;
        }
        if (historyJumpUnlockTimer.current) {
          window.clearTimeout(historyJumpUnlockTimer.current);
          historyJumpUnlockTimer.current = undefined;
        }
        pendingJumpClientMsgID.current = message.clientMsgID;
        historyJumpTargetRendered.current = false;
        isHistoryJumpingRef.current = true;
        const location = await findMessageAndLoad(message);
        if (!location) {
          pendingJumpClientMsgID.current = undefined;
          historyJumpTargetRendered.current = false;
          isHistoryJumpingRef.current = false;
          feedbackToast({ error: new Error(t("toast.messageLocationFailed")) });
          return;
        }

        pendingJumpClientMsgID.current = location.clientMsgID;
        if (import.meta.env.DEV) {
          console.info(
            `[history-location] scroll-request index=${location.messageIndex} clientMsgID=${location.clientMsgID}`,
          );
        }
        virtuoso.current?.scrollToIndex({
          index: location.messageIndex,
          align: "center",
          behavior: "smooth",
        });
      } catch (error) {
        pendingJumpClientMsgID.current = undefined;
        historyJumpTargetRendered.current = false;
        isHistoryJumpingRef.current = false;
        console.error("[history] failed to locate quoted message:", error);
        feedbackToast({ error: new Error(t("toast.messageLocationFailed")) });
      }
    },
    [findMessageAndLoad],
  );

  const imageMessages = useMemo(
    () =>
      loadState.messageList.filter(
        (message) =>
          message.contentType === MessageType.PictureMessage &&
          Boolean(
            message.pictureElem?.sourcePicture?.url ||
              message.pictureElem?.snapshotPicture?.url,
          ),
      ),
    [loadState.messageList],
  );
  const imagePreviewItems = useMemo(
    () =>
      imageMessages.map(
        (message) =>
          message.pictureElem?.sourcePicture?.url ||
          message.pictureElem?.snapshotPicture?.url ||
          "",
      ),
    [imageMessages],
  );
  const imagePreviewIndex = Math.max(
    0,
    imageMessages.findIndex((message) => message.clientMsgID === imagePreviewMessageID),
  );

  const handleImagePreview = useCallback(
    (index: number) => {
      const message = imageMessages[index];
      if (!message) return;
      setImagePreviewMessageID(message.clientMsgID);
      setImagePreviewVisible(true);
    },
    [imageMessages],
  );

  useEffect(() => {
    emitter.on("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    emitter.on("CHAT_LIST_STICK_TO_BOTTOM", stickToBottomIfNeeded);
    return () => {
      emitter.off("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
      emitter.off("CHAT_LIST_STICK_TO_BOTTOM", stickToBottomIfNeeded);
      if (stickyScrollFrame.current) {
        window.cancelAnimationFrame(stickyScrollFrame.current);
      }
      if (bottomScrollTimer.current) {
        window.clearTimeout(bottomScrollTimer.current);
      }
      if (historyJumpUnlockTimer.current) {
        window.clearTimeout(historyJumpUnlockTimer.current);
      }
    };
  }, []);

  // Clear multi-select when conversation changes
  useEffect(() => {
    isUserViewingHistory.current = false;
    pauseStickyScroll.current = false;
    pendingJumpClientMsgID.current = undefined;
    historyJumpTargetRendered.current = false;
    isHistoryJumpingRef.current = false;
    if (bottomScrollTimer.current) {
      window.clearTimeout(bottomScrollTimer.current);
      bottomScrollTimer.current = undefined;
    }
    if (historyJumpUnlockTimer.current) {
      window.clearTimeout(historyJumpUnlockTimer.current);
      historyJumpUnlockTimer.current = undefined;
    }
    setMultiSelectState({ isActive: false, selectedIds: new Set() });
    setImagePreviewVisible(false);
    setImagePreviewMessageID("");
  }, [conversationID]);

  useEffect(() => {
    if (!multiSelectState.isActive || !isAtBottom.current) return;

    requestAnimationFrame(() => {
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  }, [multiSelectState.isActive]);

  const loadMoreMessage = () => {
    if (isHistoryJumpingRef.current) return;
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
              const title = currentConversation?.groupID
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
                    content = t("messageDescription.fileMessage", {
                      file: m.fileElem?.fileName || "",
                    });
                    break;
                  case MessageType.CardMessage:
                    content = t("messageDescription.cardMessage");
                    break;
                  case MessageType.MergeMessage:
                    content =
                      m.mergeElem?.title || t("messageDescription.mergeMessage");
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
                          quotedContent = t("messageDescription.fileMessage", {
                            file: quoted.fileElem?.fileName || "",
                          });
                          break;
                        default:
                          quotedContent = t("messageDescription.catchMessage");
                      }
                    }
                    content = `${t("messageDescription.quoteMessage")}${
                      quotedContent ? ` ${quotedContent}` : ""
                    }`;
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

  const handleRevoke = useCallback(
    async (msg: MessageItemType) => {
      if (!conversationID) return;
      // 审计要求：仅允许撤销自己发送的消息，禁止群主/管理员/其他人撤销他人的消息。
      if (selfUserID !== msg.sendID) {
        feedbackToast({ msg: t("toast.revokeNotAllowed") });
        return;
      }
      try {
        await IMSDK.revokeMessage({
          conversationID,
          clientMsgID: msg.clientMsgID,
        });
        // 立即更新本地消息状态
        updateOneMessage({
          clientMsgID: msg.clientMsgID,
          contentType: MessageType.RevokeMessage,
          notificationElem: {
            detail: JSON.stringify({
              clientMsgID: msg.clientMsgID,
              revokerID: selfUserID,
              revokerNickname: "",
              revokeTime: Date.now(),
              sourceMessageSendID: msg.sendID,
              sourceMessageSendTime: msg.sendTime,
              sourceMessageSenderNickname: msg.senderNickname,
            }),
          },
        } as MessageItemType);
      } catch (error) {
        feedbackToast({ error });
      }
    },
    [conversationID, selfUserID],
  );

  // Register global "re-edit after revoke" handler so the <a> link in
  // the revocation notification can populate the input with original text.
  useEffect(() => {
    const setEditingMessage = useConversationStore.getState().setEditingMessage;
    console.log("[reEdit] register window.editRevoke", {
      listLen: loadState.messageList.length,
    });
    window.editRevoke = (clientMsgID: string) => {
      console.log("[reEdit] click handler called", { clientMsgID });
      const msg = loadState.messageList.find(
        (m: MessageItemType) => m.clientMsgID === clientMsgID,
      );
      console.log("[reEdit] found msg in list", {
        found: Boolean(msg),
        contentType: msg?.contentType,
        hasNotificationElem: Boolean(msg?.notificationElem),
        textElem: msg?.textElem,
        text: msg?.textElem?.content,
        keys: msg ? Object.keys(msg) : [],
      });
      if (!msg) return;
      // The original text of a revoked message lives in the revoke notification's
      // `notificationElem.detail` (parsed as `detail.textElem.content`), NOT in the
      // top-level msg.textElem (which the server clears on revoke).
      let text = msg.textElem?.content || "";
      if (!text && msg.notificationElem?.detail) {
        try {
          const detail = JSON.parse(msg.notificationElem.detail);
          console.log("[reEdit] parsed notification detail", {
            textElem: detail.textElem,
            text: detail.textElem?.content,
          });
          text = detail.textElem?.content || "";
        } catch (e) {
          console.warn("[reEdit] failed to parse notificationElem.detail", e);
        }
      }
      if (text) {
        console.log("[reEdit] setEditingMessage", { clientMsgID, text });
        setEditingMessage({ clientMsgID, text });
      } else {
        console.warn("[reEdit] no text extracted", {
          clientMsgID,
          contentType: msg.contentType,
          msg,
        });
      }
    };
    return () => {
      console.log("[reEdit] cleanup window.editRevoke");
      delete (window as any).editRevoke;
    };
  }, [loadState.messageList]);

  const handleForwardOneByOne = useCallback(() => {
    handleForward(selectedMessages, false);
  }, [selectedMessages, handleForward]);

  const handleMergeForward = useCallback(() => {
    handleForward(selectedMessages, true);
  }, [selectedMessages, handleForward]);

  const cancelMultiSelect = useCallback(() => {
    setMultiSelectState({ isActive: false, selectedIds: new Set() });
  }, []);

  const handleAvatarClick = useCallback((msg: MessageItemType) => {
    emitter.emit("OPEN_USER_CARD", { userID: msg.sendID });
  }, []);

  return (
    <Layout.Content
      className="relative flex h-full overflow-hidden !bg-[var(--bg-body)]"
      id="chat-main"
    >
      {loadState.initLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-body)] pt-1">
          <Spin spinning />
        </div>
      ) : (
        <Image.PreviewGroup
          items={imagePreviewItems}
          preview={{
            visible: imagePreviewVisible,
            current: imagePreviewIndex,
            onVisibleChange: setImagePreviewVisible,
            onChange: (index) => {
              const message = imageMessages[index];
              if (message) setImagePreviewMessageID(message.clientMsgID);
            },
            toolbarRender: (originalNode, { current }) => {
              const message = imageMessages[current];
              const originalUrl =
                message?.pictureElem?.sourcePicture?.url ||
                message?.pictureElem?.snapshotPicture?.url ||
                "";
              const fileName = inferDownloadFileName({ url: originalUrl });
              return (
                <div className="flex items-center gap-3">
                  {originalNode}
                  <DownloadOutlined
                    title={t("placeholder.download")}
                    className="cursor-pointer text-lg text-white"
                    onClick={() => {
                      if (!originalUrl) return;
                      void downloadFileWithProgress({
                        url: originalUrl,
                        fileName,
                        showProgressToast: true,
                        progressTitle: t("toast.downloading"),
                      }).catch((error) => {
                        console.error("Download failed:", error);
                      });
                    }}
                  />
                  <SaveOutlined
                    title={t("placeholder.saveAs")}
                    className="cursor-pointer text-lg text-white"
                    onClick={() => {
                      if (!originalUrl || !window.electronAPI?.ipcInvoke) return;
                      void (async () => {
                        const selectedPath = await window.electronAPI.ipcInvoke<
                          string | false
                        >("chooseDownloadPath", { fileName });
                        if (!selectedPath) return;
                        await downloadFileWithProgress({
                          url: originalUrl,
                          fileName,
                          filePath: selectedPath,
                          showProgressToast: true,
                          progressTitle: t("toast.downloading"),
                        });
                      })().catch((error) => {
                        console.error("Save image as failed:", error);
                      });
                    }}
                  />
                </div>
              );
            },
          }}
        >
          <Virtuoso
            id="chat-list"
            className="w-full overflow-x-hidden"
            onTouchMove={handleChatTouchMove}
            onTouchStart={handleChatTouchStart}
            onWheel={handleChatWheel}
            onScroll={handleChatScroll}
            atBottomStateChange={(atBottom) => {
              isAtBottom.current = atBottom;
              if (atBottom && !isUserViewingHistory.current) {
                pauseStickyScroll.current = false;
              }
            }}
            followOutput={(isAtBottom) =>
              isAtBottom && !isHistoryJumpingRef.current && !pauseStickyScroll.current
                ? "smooth"
                : false
            }
            itemsRendered={(items) => {
              const clientMsgID = pendingJumpClientMsgID.current;
              if (
                !clientMsgID ||
                !items.some((item) => item.data?.clientMsgID === clientMsgID)
              ) {
                return;
              }

              requestAnimationFrame(() => {
                if (pendingJumpClientMsgID.current !== clientMsgID) return;
                const element = document.getElementById(`chat_${clientMsgID}`);
                if (!element) return;

                historyJumpTargetRendered.current = true;
                element.classList.add("animate-pulse");
                setTimeout(() => element.classList.remove("animate-pulse"), 2000);
                scheduleHistoryJumpUnlock(clientMsgID);
              });
            }}
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
              Footer: () =>
                multiSelectState.isActive ? <div className="h-16" /> : null,
            }}
            computeItemKey={(_, item) => item.clientMsgID}
            itemContent={(index, message) => {
              const isShakeMessage = isShakeMessageData(message.customElem?.data);
              if (SystemMessageTypes.includes(message.contentType) || isShakeMessage) {
                return (
                  <NotificationMessage key={message.clientMsgID} message={message} />
                );
              }
              const messageIndex = loadState.messageList.findIndex(
                (item) => item.clientMsgID === message.clientMsgID,
              );
              const prev =
                messageIndex > 0 ? loadState.messageList[messageIndex - 1] : undefined;
              const showDivider =
                !prev ||
                SystemMessageTypes.includes(prev.contentType) ||
                isShakeMessageData(prev.customElem?.data) ||
                message.sendTime - prev.sendTime > TIME_DIVIDER_GAP;
              const isSender = selfUserID === message.sendID;
              const imageIndex = imageMessages.findIndex(
                (imageMessage) => imageMessage.clientMsgID === message.clientMsgID,
              );
              return (
                <>
                  {showDivider && <TimeDivider time={message.sendTime} />}
                  <MessageItem
                    key={message.clientMsgID}
                    conversationID={conversationID}
                    message={message}
                    messageUpdateFlag={message.senderNickname + message.senderFaceUrl}
                    isSender={isSender}
                    imagePreviewIndex={imageIndex >= 0 ? imageIndex : undefined}
                    onImagePreview={handleImagePreview}
                    isMultiSelectActive={multiSelectState.isActive}
                    isSelected={multiSelectState.selectedIds.has(message.clientMsgID)}
                    onToggleSelect={handleToggleSelect}
                    onForward={(msg) => handleForward([msg], false)}
                    onReply={handleReply}
                    onMultiSelect={handleMultiSelect}
                    onRevoke={handleRevoke}
                    onAvatarClick={handleAvatarClick}
                    onQuoteMessage={jumpToMessage}
                  />
                </>
              );
            }}
          />
        </Image.PreviewGroup>
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
