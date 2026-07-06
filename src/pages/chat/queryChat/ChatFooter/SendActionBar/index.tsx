import { MessageItem } from "@openim/wasm-client-sdk";
import { message as antdMessage, Popover, Upload } from "antd";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, RefObject, useState } from "react";

import cardIcon from "@/assets/images/chatFooter/card.png";
import cutIcon from "@/assets/images/chatFooter/cut.png";
import emojiIcon from "@/assets/images/chatFooter/emoji.png";
import fileIcon from "@/assets/images/chatFooter/file.png";
import image from "@/assets/images/chatFooter/image.png";
import { CKEditorRef } from "@/components/CKEditor";

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

const SendActionBar = ({
  sendMessage,
  getImageMessage,
  getFileMessage,
  getCardMessage,
  editorRef,
  onScreenshot,
}: {
  sendMessage: (params: SendMessageParams) => Promise<void>;
  getImageMessage: (file: File) => Promise<MessageItem>;
  getFileMessage: (file: File) => Promise<MessageItem>;
  getCardMessage: (user: { userID: string; nickname: string; faceURL: string }) => Promise<MessageItem>;
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
    try {
      let message: MessageItem;
      if (key === "image") {
        message = await getImageMessage(options.file as File);
      } else if (key === "file") {
        message = await getFileMessage(options.file as File);
      } else {
        return;
      }
      await sendMessage({ message });
    } catch (error) {
      console.error("[SendActionBar] send file failed:", error);
      antdMessage.error(t("toast.accessFailed"));
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

        let message: MessageItem;
        if (key === "image") {
          message = await getImageMessage(file);
        } else if (key === "file") {
          message = await getFileMessage(file);
        } else {
          return;
        }
        await sendMessage({ message });
      } catch (error) {
        console.error("[SendActionBar] send native file failed:", error);
        antdMessage.error(t("toast.accessFailed"));
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
                <img
                  src={cutIcon}
                  width={20}
                  alt={t("placeholder.screenshot")}
                  onClick={handleScreenshotClick}
                />
                <Popover
                  placement="bottomRight"
                  content={screenshotConfigContent}
                  trigger="click"
                  open={configOpen}
                  onOpenChange={setConfigOpen}
                  arrow={false}
                >
                  <div
                    className="ml-0.5 flex h-3.5 items-center border-l border-gray-300 pl-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      className="text-gray-400"
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
            onPopoverOpenChange: isEmoji
              ? (v: boolean) => setEmojiOpen(v)
              : undefined,
          };

          return (
            <ActionWrap key={action.key} {...wrapProps}>
              <div className="flex cursor-pointer items-center">
                <img src={action.icon} width={20} alt={action.title} />
              </div>
            </ActionWrap>
          );
        })}
      </div>
      <ShareCardModal
        open={cardModalOpen}
        onCancel={() => setCardModalOpen(false)}
        onConfirm={handleCardSelect}
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
