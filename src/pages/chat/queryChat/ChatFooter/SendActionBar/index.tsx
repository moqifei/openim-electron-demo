import { ThunderboltOutlined } from "@ant-design/icons";
import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover, Slider, Upload } from "antd";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, RefObject, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import cardIcon from "@/assets/images/chatFooter/card.png";
import cutIcon from "@/assets/images/chatFooter/cut.png";
import emojiIcon from "@/assets/images/chatFooter/emoji.png";
import fileIcon from "@/assets/images/chatFooter/file.png";
import image from "@/assets/images/chatFooter/image.png";
import { CKEditorRef } from "@/components/CKEditor";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store/conversation";
import {
  buildShakeMessageData,
  canUseShake,
  CHAT_SHAKE_TEXT,
} from "@/utils/shakeMessage";

import { SendMessageParams } from "../useSendMessage";
import EmojiPicker from "./EmojiPicker";
import ShareCardModal from "./ShareCardModal";

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_STEP = 2;

const sendActionList = [
  {
    title: t("placeholder.image"),
    icon: image,
    key: "image",
    accept: "image/*",
  },
  {
    title: t("placeholder.file"),
    icon: fileIcon,
    key: "file",
    accept: "*",
  },
  {
    title: t("placeholder.emoji"),
    icon: emojiIcon,
    key: "emoji",
  },
  {
    title: t("placeholder.screenshot"),
    icon: cutIcon,
    key: "screenshot",
  },
  {
    title: t("placeholder.card"),
    icon: cardIcon,
    key: "card",
  },
];

i18n.on("languageChanged", () => {
  sendActionList[0].title = t("placeholder.image");
  sendActionList[1].title = t("placeholder.file");
  sendActionList[2].title = t("placeholder.emoji");
  sendActionList[3].title = t("placeholder.screenshot");
  sendActionList[4].title = t("placeholder.card");
});

const SendActionBar = ({
  sendMessage,
  getCardMessage,
  editorRef,
  onScreenshot,
  onSelectFiles,
}: {
  sendMessage: (params: SendMessageParams) => Promise<void>;
  getCardMessage: (user: {
    userID: string;
    nickname: string;
    faceURL: string;
  }) => Promise<MessageItem>;
  editorRef: RefObject<CKEditorRef>;
  onScreenshot: (hideWindow: boolean) => void;
  onSelectFiles: (files: File[]) => void;
}) => {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [hideWindowConfig, setHideWindowConfig] = useState(() => {
    const v = localStorage.getItem("screenshotHideWindow");
    return v === null ? true : v === "true";
  });
  const [configOpen, setConfigOpen] = useState(false);

  const chatFontSize = useConversationStore((state) => state.chatFontSize);
  const setChatFontSize = useConversationStore((state) => state.setChatFontSize);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const canSendShake = canUseShake(currentConversation);

  const fileHandle = (options: UploadRequestOption, _key: string) => {
    const file = options.file as File;
    onSelectFiles([file]);
    options.onSuccess?.("ok" as any);
  };

  const nativeFileHandle = async (key: string) => {
    if (!window.electronAPI?.openFileDialog || !window.electronAPI?.getFileByPath) {
      return;
    }

    const filePaths = await window.electronAPI.openFileDialog({
      properties: ["openFile", "multiSelections"],
      filters:
        key === "image"
          ? [
              {
                name: "Images",
                extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
              },
            ]
          : undefined,
    });

    console.info("[SendActionBar] native selected files", { key, filePaths });

    const files: File[] = [];
    for (const filePath of filePaths) {
      try {
        const file = await window.electronAPI.getFileByPath(filePath);
        if (!file) {
          throw new Error(`Failed to read selected file: ${filePath}`);
        }
        Object.defineProperty(file, "path", {
          configurable: true,
          value: filePath,
        });
        console.info("[SendActionBar] native file loaded", {
          key,
          filePath,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
        files.push(file);
      } catch (error) {
        console.error("[SendActionBar] read native file failed:", error);
        antdMessage.error(t("toast.accessFailed"));
      }
    }
    if (files.length > 0) onSelectFiles(files);
  };

  const handleEmojiSelect = (emoji: string) => {
    editorRef.current?.insertText(emoji);
    setEmojiOpen(false);
  };

  const handleCardSelect = async (user: {
    userID: string;
    nickname: string;
    faceURL: string;
  }) => {
    const message = await getCardMessage(user);
    sendMessage({ message });
    setCardModalOpen(false);
  };

  const handleShake = async () => {
    if (!canSendShake) return;
    if (!currentConversation?.userID) return;
    try {
      const { data: message } = await IMSDK.createCustomMessage({
        data: buildShakeMessageData(),
        extension: "",
        description: CHAT_SHAKE_TEXT,
      });
      await sendMessage({
        message,
        recvID: currentConversation.userID,
        groupID: "",
      });
      window.electronAPI?.ipcSend("shakeMainWindow", {
        durationMs: 1000,
      });
    } catch (error) {
      console.error("[SendActionBar] send shake failed:", error);
      antdMessage.error(t("toast.accessFailed"));
    }
  };

  const handleScreenshotClick = () => {
    onScreenshot(hideWindowConfig);
  };

  const toggleHideWindow = () => {
    const next = !hideWindowConfig;
    setHideWindowConfig(next);
    localStorage.setItem("screenshotHideWindow", String(next));
  };

  const screenshotConfigContent = (
    <div
      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
      onClick={(e) => {
        e.stopPropagation();
        toggleHideWindow();
      }}
    >
      <div
        className={`flex h-4 w-4 items-center justify-center rounded border text-xs ${
          hideWindowConfig
            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
            : "border-gray-300"
        }`}
      >
        {hideWindowConfig && "✓"}
      </div>
      <span>截图时隐藏窗口</span>
    </div>
  );

  const fontPickerContent = (
    <div className="flex flex-col items-center gap-2 px-4 py-3" style={{ width: 200 }}>
      <div className="text-sm text-gray-500">
        {i18n.language?.startsWith("zh") ? "字体大小" : "Font Size"}:{" "}
        <span className="font-medium text-gray-800">{chatFontSize}px</span>
      </div>
      <Slider
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={FONT_SIZE_STEP}
        value={chatFontSize}
        onChange={(v) => setChatFontSize(v)}
        className="!w-full"
      />
      <div className="flex w-full justify-between text-xs text-gray-400">
        <span>{FONT_SIZE_MIN}px</span>
        <span>{FONT_SIZE_MAX}px</span>
      </div>
      <div
        className="w-full rounded border border-gray-200 p-2 text-center"
        style={{ fontSize: chatFontSize, lineHeight: 1.5 }}
      >
        Aa 示例 Sample
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-5 px-4.5 pt-2">
        {/* Font size picker */}
        <Popover
          placement="bottomLeft"
          content={fontPickerContent}
          trigger="click"
          open={fontPickerOpen}
          onOpenChange={setFontPickerOpen}
          arrow={false}
        >
          <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
          </div>
        </Popover>

        {canSendShake && (
          <div
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            title="抖一抖"
            aria-label="抖一抖"
            onClick={() => {
              void handleShake();
            }}
          >
            <ThunderboltOutlined />
          </div>
        )}

        {sendActionList.map((action) => {
          const isEmoji = action.key === "emoji";
          const isCard = action.key === "card";
          const isScreenshot = action.key === "screenshot";

          if (isScreenshot) {
            return (
              <div key={action.key} className="flex cursor-pointer items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]">
                  <img
                    src={cutIcon}
                    width={20}
                    alt={t("placeholder.screenshot")}
                    title={t("placeholder.screenshot")}
                    onClick={handleScreenshotClick}
                  />
                </div>
                <Popover
                  placement="bottomRight"
                  content={screenshotConfigContent}
                  trigger="click"
                  open={configOpen}
                  onOpenChange={setConfigOpen}
                  arrow={false}
                >
                  <div
                    className="ml-0.5 flex h-3.5 items-center border-l border-[var(--border-color)] pl-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      className="text-[var(--text-placeholder)]"
                    >
                      <path d="M0 2 L4 6 L8 2 Z" fill="currentColor" />
                    </svg>
                  </div>
                </Popover>
              </div>
            );
          }

          const wrapProps = {
            accept: action.accept,
            actionKey: action.key,
            fileHandle,
            nativeFileHandle,
            onClick: isCard ? () => setCardModalOpen(true) : undefined,
            popoverContent: isEmoji ? (
              <EmojiPicker onSelect={handleEmojiSelect} />
            ) : undefined,
            popoverOpen: isEmoji ? emojiOpen : undefined,
            onPopoverOpenChange: isEmoji ? (v: boolean) => setEmojiOpen(v) : undefined,
          };

          return (
            <ActionWrap key={action.key} {...wrapProps}>
              <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]">
                <img src={action.icon} width={20} alt={action.title} />
              </div>
            </ActionWrap>
          );
        })}
      </div>
      <ShareCardModal
        open={cardModalOpen}
        onCancel={() => setCardModalOpen(false)}
        onConfirm={(user) => {
          void handleCardSelect(user);
        }}
      />
    </>
  );
};

export default memo(SendActionBar);

const ActionWrap = ({
  accept,
  actionKey,
  children,
  fileHandle,
  nativeFileHandle,
  onClick,
  popoverContent,
  popoverOpen,
  onPopoverOpenChange,
}: {
  accept?: string;
  children: ReactNode;
  actionKey: string;
  fileHandle: (options: UploadRequestOption, key: string) => void;
  nativeFileHandle: (key: string) => void;
  onClick?: () => void;
  popoverContent?: ReactNode;
  popoverOpen?: boolean;
  onPopoverOpenChange?: (open: boolean) => void;
}) => {
  if (accept) {
    if (window.electronAPI?.openFileDialog) {
      return (
        <div className="flex" onClick={() => nativeFileHandle(actionKey)}>
          {children}
        </div>
      );
    }

    return (
      <Upload
        showUploadList={false}
        customRequest={(options) => fileHandle(options, actionKey)}
        accept={accept}
        multiple
        className="flex"
      >
        {children}
      </Upload>
    );
  }

  if (popoverContent) {
    return (
      <Popover
        placement="top"
        content={popoverContent}
        title={null}
        arrow={false}
        trigger="click"
        open={popoverOpen}
        onOpenChange={onPopoverOpenChange}
      >
        {children}
      </Popover>
    );
  }

  return (
    <div className="flex" onClick={onClick}>
      {children}
    </div>
  );
};
