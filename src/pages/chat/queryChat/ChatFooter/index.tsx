import { CloseOutlined } from "@ant-design/icons";
import { MessageItem, MessageType, SessionType } from "@openim/wasm-client-sdk";
import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { useLatest } from "ahooks";
import { Button, message } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import CKEditor, { CKEditorRef } from "@/components/CKEditor";
import { getCleanText } from "@/components/CKEditor/utils";
import i18n from "@/i18n";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { isAgentConversation } from "@/utils/agentConversation";
import { canSendImageTypeList } from "@/utils/common";

import AtMemberPopup, { AtMemberInfo } from "./AtMemberPopup";
import SendActionBar from "./SendActionBar";
import ScreenshotCropper from "./SendActionBar/ScreenshotCropper";
import { useFileMessage } from "./SendActionBar/useFileMessage";
import { useSendMessage } from "./useSendMessage";

const sendActions = [
  { label: t("placeholder.sendWithEnter"), key: "enter" },
  { label: t("placeholder.sendWithShiftEnter"), key: "enterwithshift" },
];

const agentPromptTemplates = [
  "帮我写一段文案",
  "总结一下这段内容",
  "把这段话润色得更正式",
];

i18n.on("languageChanged", () => {
  sendActions[0].label = t("placeholder.sendWithEnter");
  sendActions[1].label = t("placeholder.sendWithShiftEnter");
});

const isImageFile = (file: File) => {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? canSendImageTypeList.includes(ext) : false;
};

interface PendingFileItem {
  id: string;
  file: File;
  previewUrl: string;
}

let pendingIdCounter = 0;

const ChatFooter: ForwardRefRenderFunction<unknown, unknown> = (_, ref) => {
  const [html, setHtml] = useState("");
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFileItem[]>([]);
  const latestHtml = useLatest(html);
  const editorRef = useRef<CKEditorRef>(null);

  // @mention state
  const [atPopupVisible, setAtPopupVisible] = useState(false);
  const [groupMemberList, setGroupMemberList] = useState<GroupMemberItem[]>([]);
  // Track @mentions by userID -> { nickname, groupNickname }
  const atMembersRef = useRef<Map<string, { nickname: string; groupNickname: string }>>(
    new Map(),
  );
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { getImageMessage, getFileMessage, getCardMessage } = useFileMessage();
  const { sendMessage } = useSendMessage();
  const quoteMessage = useConversationStore((state) => state.quoteMessage);
  const setQuoteMessage = useConversationStore((state) => state.setQuoteMessage);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const isAgentChat = isAgentConversation(currentConversation);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPendingFiles = useCallback((files: FileList | File[]) => {
    const newItems: PendingFileItem[] = [];
    for (const file of Array.from(files)) {
      newItems.push({
        id: `pending-${++pendingIdCounter}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingFiles((prev) => [...prev, ...newItems]);
  }, []);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleSendPendingFiles = useCallback(
    async (files: PendingFileItem[]) => {
      for (const item of files) {
        try {
          const file = item.file;
          if (isImageFile(file)) {
            const msg = await getImageMessage(file);
            await sendMessage({ message: msg });
          } else {
            const msg = await getFileMessage(file);
            await sendMessage({ message: msg });
          }
        } catch (error) {
          console.error("[ChatFooter] send file failed:", error);
          message.error(t("toast.accessFailed"));
        }
      }
    },
    [getImageMessage, getFileMessage, sendMessage],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files: File[] = [];
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length === 0 && e.clipboardData?.files.length) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          files.push(e.clipboardData.files[i]);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        addPendingFiles(files);
      }
    },
    [addPendingFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addPendingFiles(e.dataTransfer.files);
      }
    },
    [addPendingFiles],
  );

  const startScreenshot = useCallback(async (hideWindow: boolean) => {
    if (!window.electronAPI) {
      message.warning(t("toast.accessFailed"));
      return;
    }
    setScreenshotLoading(true);
    try {
      const base64 = await window.electronAPI.startScreenshot(hideWindow);
      if (base64) {
        setScreenshotSrc(base64);
      }
    } catch (error: any) {
      console.error("[ChatFooter] screenshot failed:", error);
      if (error?.message === "SCREEN_RECORDING_PERMISSION_DENIED") {
        message.error(t("toast.screenshotPermissionDenied"));
      } else {
        message.error(t("toast.accessFailed"));
      }
    } finally {
      setScreenshotLoading(false);
    }
  }, []);

  const handleScreenshotConfirm = useCallback(
    async (croppedBase64: string) => {
      setScreenshotSrc(null);
      try {
        if (!window.electronAPI) {
          message.error(t("toast.accessFailed"));
          return;
        }
        // Save screenshot to temp file, then send via full path to avoid File clone issue
        const filePath = await window.electronAPI.saveScreenshotFile(croppedBase64);
        const imageMessage = (await IMSDK.createImageMessageFromFullPath(filePath))
          .data;
        imageMessage.pictureElem!.sourcePicture.url = croppedBase64;
        await sendMessage({ message: imageMessage });
      } catch (error) {
        console.error("[ChatFooter] send screenshot failed:", error);
        message.error(t("toast.accessFailed"));
      }
    },
    [sendMessage],
  );

  const handleScreenshotCancel = useCallback(() => {
    setScreenshotSrc(null);
  }, []);

  const onChange = (value: string) => {
    setHtml(value);
  };

  const insertAgentTemplate = useCallback((template: string) => {
    if (editorRef.current) {
      editorRef.current.setText(template);
      return;
    }
    setHtml(template);
  }, []);

  // ====== @mention logic ======
  const isGroupChat = currentConversation?.conversationType === SessionType.Group;
  console.log(
    "[ChatFooter] isGroupChat:",
    isGroupChat,
    "conversationType:",
    currentConversation?.conversationType,
    "groupID:",
    currentConversation?.groupID,
  );

  const fetchGroupMembers = useCallback(async () => {
    const groupID = currentConversation?.groupID;
    console.log("[ChatFooter] fetchGroupMembers called, groupID:", groupID);
    if (!groupID) return;
    try {
      const { data } = await IMSDK.getGroupMemberList({
        groupID,
        filter: 0,
        offset: 0,
        count: 500,
      });
      console.log("[ChatFooter] getGroupMemberList result count:", data?.length);
      setGroupMemberList(data || []);
    } catch (e) {
      console.error("[ChatFooter] getGroupMemberList failed:", e);
    }
  }, [currentConversation?.groupID]);

  const handleEditorKeydown = useCallback(
    (e: KeyboardEvent) => {
      console.log(
        "[ChatFooter handleEditorKeydown] key:",
        e?.key,
        "isGroupChat:",
        isGroupChat,
        "atPopupVisible:",
        atPopupVisible,
      );
      if (!isGroupChat) {
        console.log("[ChatFooter] not group chat, skipping @");
        return;
      }
      if (e?.key === "@") {
        console.log("[ChatFooter] @ detected, fetching members...");
        e.preventDefault(); // 阻止 CKEditor 默认插入 @ 字符，避免 @@ 双 @
        e.stopPropagation();
        fetchGroupMembers().then(() => {
          console.log("[ChatFooter] members fetched, setting atPopupVisible=true");
          setAtPopupVisible(true);
        });
      } else if (e?.key === "Escape" && atPopupVisible) {
        console.log("[ChatFooter] Escape pressed, closing popup");
        setAtPopupVisible(false);
      }
    },
    [isGroupChat, atPopupVisible, fetchGroupMembers],
  );

  const handleAtSelect = useCallback((member: AtMemberInfo) => {
    const displayName =
      member.userID === "AtAllTag"
        ? `@${t("placeholder.mentionAll")}`
        : `@${member.nickname}`;
    // Store mapping for later lookup on send
    atMembersRef.current.set(member.userID, {
      nickname: member.nickname,
      groupNickname: member.groupNickname || member.nickname,
    });
    editorRef.current?.insertText(`${displayName} `);
    setAtPopupVisible(false);
  }, []);

  const handleAtClose = useCallback(() => {
    setAtPopupVisible(false);
  }, []);

  const enterToSend = useCallback(async () => {
    const cleanText = getCleanText(latestHtml.current ?? "");

    // Send pending files first
    const filesToSend = pendingFiles.length > 0 ? [...pendingFiles] : null;
    if (filesToSend) {
      filesToSend.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingFiles([]);
      await handleSendPendingFiles(filesToSend);
    }

    if (!cleanText) return;
    // Clear input BEFORE awaiting (keep local copy of text and at ref)
    const sendText = cleanText;
    const currentAtMembers = new Map(atMembersRef.current);
    setHtml("");
    atMembersRef.current.clear();

    let message: MessageItem;
    const storeQuoteMessage = useConversationStore.getState().quoteMessage;
    const storeSetQuoteMessage = useConversationStore.getState().setQuoteMessage;

    // Check if the text contains @mentions tracked by atMembersRef
    const atNames = Array.from(currentAtMembers.entries()); // [userId, {nickname, groupNickname}]
    const matchedUsers: { userID: string; groupNickname: string }[] = [];

    console.log("[ChatFooter enterToSend] sendText:", sendText, "atNames:", atNames);

    for (const [userId, info] of atNames) {
      const searchPattern =
        userId === "AtAllTag" ? `@${t("placeholder.mentionAll")}` : `@${info.nickname}`;
      console.log(
        "[ChatFooter enterToSend] checking pattern:",
        searchPattern,
        "found:",
        sendText.includes(searchPattern),
      );
      if (sendText.includes(searchPattern)) {
        matchedUsers.push({
          userID: userId,
          groupNickname: info.groupNickname,
        });
      }
    }

    console.log(
      "[ChatFooter enterToSend] matchedUsers:",
      matchedUsers,
      "hasQuote:",
      Boolean(storeQuoteMessage),
    );

    if (matchedUsers.length > 0 || storeQuoteMessage) {
      if (storeQuoteMessage) {
        const { data } = await IMSDK.createQuoteMessage({
          text: sendText,
          message: JSON.stringify(storeQuoteMessage),
        });
        message = data;
        storeSetQuoteMessage(undefined);
      } else {
        const atUserIDList = matchedUsers.map((u) => u.userID);
        const atUsersInfo = matchedUsers.map((u) => ({
          atUserID: u.userID,
          groupNickname: u.groupNickname,
        }));
        console.log("[ChatFooter enterToSend] calling createTextAtMessage:", {
          text: sendText,
          atUserIDList,
          atUsersInfo,
        });
        const { data } = await IMSDK.createTextAtMessage({
          text: sendText,
          atUserIDList,
          atUsersInfo,
        });
        message = data;
        // Clear only if we sent @message successfully
      }
    } else {
      const { data } = await IMSDK.createTextMessage(sendText);
      message = data;
    }

    await sendMessage({ message });
  }, [pendingFiles, handleSendPendingFiles, sendMessage]);

  const getQuotePreview = (msg: MessageItem) => {
    switch (msg.contentType) {
      case MessageType.TextMessage:
        return msg.textElem?.content || "";
      case MessageType.PictureMessage:
        return t("messageDescription.imageMessage");
      case MessageType.FileMessage:
        return t("messageDescription.fileMessage", {
          file: msg.fileElem?.fileName || "",
        });
      case MessageType.CardMessage:
        return t("messageDescription.cardMessage");
      case MessageType.MergeMessage:
        return msg.mergeElem?.title || t("messageDescription.mergeMessage");
      default:
        return t("messageDescription.catchMessage");
    }
  };

  return (
    <footer
      className="relative h-full bg-white py-px"
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-full flex-col border-t border-t-[var(--gap-text)]">
        <SendActionBar
          sendMessage={sendMessage}
          getImageMessage={getImageMessage}
          getFileMessage={getFileMessage}
          getCardMessage={getCardMessage}
          editorRef={editorRef}
          onScreenshot={startScreenshot}
        />
        <div
          ref={editorContainerRef}
          className="relative flex flex-1 flex-col overflow-hidden"
        >
          {quoteMessage && (
            <div className="flex items-center justify-between border-b border-[var(--gap-text)] bg-[var(--chat-bubble)] px-4 py-2">
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="text-xs text-[var(--primary)]">
                  {t("placeholder.reply")} {quoteMessage.senderNickname}
                </span>
                <span className="truncate text-xs text-[var(--sub-text)]">
                  {getQuotePreview(quoteMessage)}
                </span>
              </div>
              <CloseOutlined
                className="cursor-pointer text-[var(--sub-text)]"
                rev={undefined}
                onClick={() => setQuoteMessage(undefined)}
              />
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-[var(--gap-text)] bg-[var(--chat-bubble)] px-3 py-2">
              {pendingFiles.map((item) =>
                item.file.type.startsWith("image/") ||
                canSendImageTypeList.includes(
                  item.file.name.split(".").pop()?.toLowerCase() || "",
                ) ? (
                  <div
                    key={item.id}
                    className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removePendingFile(item.id)}
                    >
                      <CloseOutlined className="text-sm text-white" />
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.id}
                    className="group relative flex h-16 max-w-[120px] flex-shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-gray-200 bg-white px-2"
                  >
                    <svg
                      className="h-6 w-6 flex-shrink-0 text-gray-400"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span className="truncate text-xs text-gray-600">
                      {item.file.name}
                    </span>
                    <div
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removePendingFile(item.id)}
                    >
                      <CloseOutlined className="text-sm text-white" />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
          {isAgentChat && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#efe7ff] bg-gradient-to-r from-[#fbf7ff] to-white px-3 py-2">
              <span className="shrink-0 text-xs font-medium text-[#7c3aed]">
                智能体快捷指令
              </span>
              {agentPromptTemplates.map((template) => (
                <button
                  key={template}
                  type="button"
                  className="rounded-full border border-[#ddd6fe] bg-white px-2.5 py-1 text-xs text-[#6d28d9] transition hover:border-[#a78bfa] hover:bg-[#f3e8ff]"
                  onClick={() => insertAgentTemplate(template)}
                >
                  {template}
                </button>
              ))}
            </div>
          )}
          <CKEditor
            key={`${currentConversation?.conversationID ?? "empty"}-${
              isAgentChat ? "agent" : "normal"
            }`}
            ref={editorRef}
            value={html}
            placeholder={isAgentChat ? "给智能体发消息..." : ""}
            onEnter={enterToSend}
            onChange={onChange}
            onPasteFile={addPendingFiles}
            onKeydown={handleEditorKeydown}
          />
          <div className="flex items-center justify-end py-2 pr-3">
            <Button
              className="w-fit px-6 py-1"
              type="primary"
              onClick={enterToSend}
              loading={screenshotLoading}
            >
              {t("placeholder.send")}
            </Button>
          </div>
        </div>
      </div>
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.3)]">
          <div className="rounded-lg bg-white px-8 py-4 text-lg font-medium text-[var(--primary)] shadow-lg">
            {t("placeholder.releaseToUpload")}
          </div>
        </div>
      )}
      {screenshotSrc && (
        <ScreenshotCropper
          imageSrc={screenshotSrc}
          onConfirm={handleScreenshotConfirm}
          onCancel={handleScreenshotCancel}
        />
      )}
      {/* @mention popup rendered via Portal to avoid overflow-hidden clipping */}
      {atPopupVisible &&
        editorContainerRef.current &&
        createPortal(
          <div
            style={{
              position: "fixed",
              zIndex: 1000,
              left: editorContainerRef.current.getBoundingClientRect().left,
              top: editorContainerRef.current.getBoundingClientRect().top - 280,
              width: editorContainerRef.current.getBoundingClientRect().width,
            }}
          >
            <AtMemberPopup
              visible={true}
              members={groupMemberList}
              onSelect={handleAtSelect}
              onClose={handleAtClose}
            />
          </div>,
          document.body,
        )}
    </footer>
  );
};

export default memo(forwardRef(ChatFooter));
