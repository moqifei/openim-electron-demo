import { MessageItem } from "@openim/wasm-client-sdk";
import { FriendUserItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover, Upload } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, RefObject, useState } from "react";

import cardIcon from "@/assets/images/chatFooter/card.png";
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
    title: t("placeholder.card"),
    icon: cardIcon,
    key: "card",
  },
];

i18n.on("languageChanged", () => {
  sendActionList[0].title = t("placeholder.image");
  sendActionList[1].title = t("placeholder.file");
  sendActionList[2].title = t("placeholder.emoji");
  sendActionList[3].title = t("placeholder.card");
});

const SendActionBar = ({
  sendMessage,
  getImageMessage,
  getFileMessage,
  getCardMessage,
  editorRef,
}: {
  sendMessage: (params: SendMessageParams) => Promise<void>;
  getImageMessage: (file: File) => Promise<MessageItem>;
  getFileMessage: (file: File) => Promise<MessageItem>;
  getCardMessage: (user: FriendUserItem) => Promise<MessageItem>;
  editorRef: RefObject<CKEditorRef>;
}) => {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);

  const fileHandle = async (options: UploadRequestOption, key: string) => {
    let message: MessageItem;
    if (key === "image") {
      message = await getImageMessage(options.file as File);
    } else if (key === "file") {
      message = await getFileMessage(options.file as File);
    } else {
      return;
    }
    sendMessage({ message });
  };

  const handleEmojiSelect = (emoji: string) => {
    editorRef.current?.insertText(emoji);
    setEmojiOpen(false);
  };

  const handleCardSelect = async (user: FriendUserItem) => {
    const message = await getCardMessage(user);
    sendMessage({ message });
    setCardModalOpen(false);
  };

  return (
    <>
      <div className="flex items-center px-4.5 pt-2">
        {sendActionList.map((action) => {
          const isEmoji = action.key === "emoji";
          const isCard = action.key === "card";

          const wrapProps = {
            accept: action.accept,
            actionKey: action.key,
            fileHandle,
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
              <div
                className={clsx("flex cursor-pointer items-center last:mr-0", {
                  "mr-5": !action.accept,
                })}
              >
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
  onClick,
  popoverContent,
  popoverOpen,
  onPopoverOpenChange,
}: {
  accept?: string;
  children: ReactNode;
  actionKey: string;
  fileHandle: (options: UploadRequestOption, key: string) => void;
  onClick?: () => void;
  popoverContent?: ReactNode;
  popoverOpen?: boolean;
  onPopoverOpenChange?: (open: boolean) => void;
}) => {
  if (accept) {
    return (
      <Upload
        showUploadList={false}
        customRequest={(options) => fileHandle(options, actionKey)}
        accept={accept}
        multiple
        className="mr-5 flex"
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
