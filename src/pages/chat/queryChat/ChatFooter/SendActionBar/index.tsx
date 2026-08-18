import { MessageItem } from "@openim/wasm-client-sdk";
import { Popover, Upload } from "antd";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, RefObject, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { EMPTY_FILE_UPLOAD_ERROR_MESSAGE } from "@/api/imApi";
import cardIcon from "@/assets/images/chatFooter/card.png";
import cutIcon from "@/assets/images/chatFooter/cut.png";
import emojiIcon from "@/assets/images/chatFooter/emoji.png";
import fileIcon from "@/assets/images/chatFooter/file.png";
import image from "@/assets/images/chatFooter/image.png";
import { CKEditorRef } from "@/components/CKEditor";
import {
  createFileTransferProgressKey,
  showFileTransferProgress,
} from "@/utils/fileTransferProgress";

import { SendMessageParams } from "../useSendMessage";
import EmojiPicker from "./EmojiPicker";
import ShareCardModal from "./ShareCardModal";

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

const getFileSendErrorMessage = (error: unknown) =>
  error instanceof Error && error.message === EMPTY_FILE_UPLOAD_ERROR_MESSAGE
    ? error.message
    : t("toast.accessFailed");

const SendActionBar = ({
  sendMessage,
  getImageMessage,
  getFileMessage,
  getCardMessage,
  editorRef,
  onScreenshot,
}: {
  sendMessage: (params: SendMessageParams) => Promise<void>;
  getImageMessage: (
    file: File,
    options?: { onProgress?: (progress: number) => void },
  ) => Promise<MessageItem>;
  getFileMessage: (
    file: File,
    options?: { onProgress?: (progress: number) => void },
  ) => Promise<MessageItem>;
  getCardMessage: (user: {
    userID: string;
    nickname: string;
    faceURL: string;
  }) => Promise<MessageItem>;
  editorRef: RefObject<CKEditorRef>;
  onScreenshot: (hideWindow: boolean) => void;
}) => {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [hideWindowConfig, setHideWindowConfig] = useState(() => {
    const v = localStorage.getItem("screenshotHideWindow");
    return v === null ? true : v === "true";
  });
  const [configOpen, setConfigOpen] = useState(false);

  const fileHandle = async (options: UploadRequestOption, key: string) => {
    const file = options.file as File;
    const progressKey = createFileTransferProgressKey("chat-upload");
    const updateProgress = (progress: number) => {
      showFileTransferProgress({
        key: progressKey,
        fileName: file.name,
        title: t("toast.uploading"),
        percent: progress,
      });
    };

    try {
      updateProgress(0);
      let message: MessageItem;
      if (key === "image") {
        message = await getImageMessage(file, { onProgress: updateProgress });
      } else if (key === "file") {
        message = await getFileMessage(file, { onProgress: updateProgress });
      } else {
        return;
      }
      await sendMessage({ message });
      showFileTransferProgress({
        key: progressKey,
        fileName: file.name,
        title: t("placeholder.uploadSuccess"),
        percent: 100,
        status: "success",
      });
    } catch (error) {
      console.error("[SendActionBar] send file failed:", error);
      showFileTransferProgress({
        key: progressKey,
        fileName: file.name,
        title: t("toast.uploadFailed"),
        percent: 100,
        status: "exception",
      });
      antdMessage.error(getFileSendErrorMessage(error));
    }
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

    for (const filePath of filePaths) {
      const progressKey = createFileTransferProgressKey("chat-upload");
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
        const updateProgress = (progress: number) => {
          showFileTransferProgress({
            key: progressKey,
            fileName: file.name,
            title: t("toast.uploading"),
            percent: progress,
          });
        };

        let message: MessageItem;
        if (key === "image") {
          message = await getImageMessage(file, { onProgress: updateProgress });
        } else if (key === "file") {
          message = await getFileMessage(file, { onProgress: updateProgress });
        } else {
          return;
        }
        await sendMessage({ message });
        showFileTransferProgress({
          key: progressKey,
          fileName: file.name,
          title: t("placeholder.uploadSuccess"),
          percent: 100,
          status: "success",
        });
      } catch (error) {
        console.error("[SendActionBar] send native file failed:", error);
        showFileTransferProgress({
          key: progressKey,
          fileName: filePath,
          title: t("toast.uploadFailed"),
          percent: 100,
          status: "exception",
        });
        antdMessage.error(getFileSendErrorMessage(error));
      }
    }
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

  return (
    <>
      <div className="flex items-center gap-5 px-4.5 pt-2">
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
                    title="截图（Ctrl+Shift+X）"
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
