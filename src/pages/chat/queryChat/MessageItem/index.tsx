import { MoreOutlined } from "@ant-design/icons";
import { MessageItem as MessageItemType, MessageType } from "@openim/wasm-client-sdk";
import { Checkbox, Dropdown, MenuProps } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, useRef, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { formatMessageTime } from "@/utils/imCommon";

import CardMessageRender from "./CardMessageRender";
import CatchMessageRender from "./CatchMsgRenderer";
import FileMessageRender from "./FileMessageRender";
import MediaMessageRender from "./MediaMessageRender";
import MergeMessageRender from "./MergeMessageRender";
import styles from "./message-item.module.scss";
import MessageItemErrorBoundary from "./MessageItemErrorBoundary";
import MessageSuffix from "./MessageSuffix";
import QuoteMessageRender from "./QuoteMessageRender";
import TextMessageRender from "./TextMessageRender";

export interface IMessageItemProps {
  message: MessageItemType;
  isSender: boolean;
  disabled?: boolean;
  conversationID?: string;
  messageUpdateFlag?: string;
  isGroupChat?: boolean;
  isMultiSelectActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (clientMsgID: string) => void;
  onForward?: (message: MessageItemType) => void;
  onReply?: (message: MessageItemType) => void;
  onMultiSelect?: (message: MessageItemType) => void;
  onDelete?: (message: MessageItemType) => void;
}

const components: Record<number, FC<IMessageItemProps>> = {
  [MessageType.TextMessage]: TextMessageRender,
  [MessageType.PictureMessage]: MediaMessageRender,
  [MessageType.FileMessage]: FileMessageRender,
  [MessageType.CardMessage]: CardMessageRender,
  [MessageType.QuoteMessage]: QuoteMessageRender,
  [MessageType.MergeMessage]: MergeMessageRender,
};

const MessageItem: FC<IMessageItemProps> = ({
  message,
  disabled,
  isSender,
  conversationID,
  isMultiSelectActive,
  isSelected,
  onToggleSelect,
  onForward,
  onReply,
  onMultiSelect,
  onDelete,
}) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const MessageRenderComponent = components[message.contentType] || CatchMessageRender;

  // Look up sender's display name from friend list (remark > nickname > senderNickname).
  const senderName = useContactStore((state) => {
    const friend = state.friendList.find((f) => f.userID === message.sendID);
    return friend?.remark || friend?.nickname || message.senderNickname;
  });

  const showActions = !disabled && !isMultiSelectActive && (hovered || menuOpen);
  const isTextMessage = message.contentType === MessageType.TextMessage;

  const actionItems: MenuProps["items"] = [
    { key: "forward", label: t("placeholder.forward"), onClick: () => onForward?.(message) },
    { key: "reply", label: t("placeholder.reply"), onClick: () => onReply?.(message) },
    ...(isTextMessage
      ? [
          {
            key: "copy",
            label: t("placeholder.copy"),
            onClick: () => {
              const text = message.textElem?.content || "";
              navigator.clipboard.writeText(text).then(
                () => feedbackToast({ msg: t("toast.copySuccess") }),
                () => feedbackToast({ msg: t("toast.copyFailed") }),
              );
            },
          },
        ]
      : []),
    { key: "check", label: t("placeholder.check"), onClick: () => onMultiSelect?.(message) },
    { key: "delete", label: t("placeholder.delete"), onClick: () => onDelete?.(message) },
  ];

  return (
    <>
      <div
        id={`chat_${message.clientMsgID}`}
        className={clsx(
          "relative flex select-text px-5 py-3",
          isMultiSelectActive && "cursor-pointer",
        )}
        onClick={() => {
          if (isMultiSelectActive && onToggleSelect) {
            onToggleSelect(message.clientMsgID);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isMultiSelectActive && (
          <div className="flex items-center pr-3">
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect?.(message.clientMsgID)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div
          className={clsx(
            styles["message-container"],
            isSender && styles["message-container-sender"],
          )}
        >
          <OIMAvatar
            size={36}
            src={message.senderFaceUrl}
            text={senderName}
          />

          <div className={styles["message-wrap"]} ref={messageWrapRef}>
            <div className={styles["message-profile"]}>
              <div
                title={senderName}
                className={clsx(
                  "max-w-[30%] truncate text-[var(--sub-text)]",
                  isSender ? "ml-2" : "mr-2",
                )}
              >
                {senderName}
              </div>
              <div className="text-[var(--sub-text)]">
                {formatMessageTime(message.sendTime)}
              </div>
            </div>

            <div className={styles["menu-wrap"]}>
              <MessageItemErrorBoundary message={message}>
                <MessageRenderComponent
                  message={message}
                  isSender={isSender}
                  disabled={disabled}
                />
              </MessageItemErrorBoundary>

              <MessageSuffix
                message={message}
                isSender={isSender}
                disabled={false}
                conversationID={conversationID}
              />

              {showActions && (
                <div className="flex items-center">
                  <Dropdown
                    menu={{ items: actionItems }}
                    trigger={["hover"]}
                    onOpenChange={setMenuOpen}
                    mouseEnterDelay={0}
                    mouseLeaveDelay={0.2}
                  >
                    <MoreOutlined className="cursor-pointer px-1 text-[var(--sub-text)] hover:text-[var(--primary)]" />
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(MessageItem);
