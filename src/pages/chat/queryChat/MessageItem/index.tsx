import {
  CopyOutlined,
  MessageOutlined,
  RollbackOutlined,
  SelectOutlined,
} from "@ant-design/icons";
import { MessageItem as MessageItemType, MessageType } from "@openim/wasm-client-sdk";
import { Checkbox, Tooltip } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, useRef, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import {
  getAgentStreamPayload,
  isAgentStreamMessage,
} from "@/utils/agentStreamMessage";
import { feedbackToast } from "@/utils/common";
import {
  extractDigitalTwinText,
  isDigitalTwinMessage,
} from "@/utils/digitalTwinMessage";
import { formatMessageTime } from "@/utils/imCommon";

import AgentStreamMessageRender from "./AgentStreamMessageRender";
import AtTextMessageRender from "./AtTextMessageRender";
import CardMessageRender from "./CardMessageRender";
import CatchMessageRender from "./CatchMsgRenderer";
import DigitalTwinMessageRender from "./DigitalTwinMessageRender";
import FileMessageRender from "./FileMessageRender";
import ForwardMessageIcon from "./ForwardMessageIcon";
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
  onRevoke?: (message: MessageItemType) => void;
}

const components: Record<number, FC<IMessageItemProps>> = {
  [MessageType.TextMessage]: TextMessageRender,
  [MessageType.PictureMessage]: MediaMessageRender,
  [MessageType.FileMessage]: FileMessageRender,
  [MessageType.CardMessage]: CardMessageRender,
  [MessageType.QuoteMessage]: QuoteMessageRender,
  [MessageType.MergeMessage]: MergeMessageRender,
  [MessageType.AtTextMessage]: AtTextMessageRender,
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
  onRevoke,
}) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const isDigitalTwin = isDigitalTwinMessage(message);
  const isAgentStream = isAgentStreamMessage(message);
  const MessageRenderComponent = isAgentStream
    ? AgentStreamMessageRender
    : isDigitalTwin
    ? DigitalTwinMessageRender
    : components[message.contentType] || CatchMessageRender;

  // Look up sender's display name from friend list (remark > nickname > senderNickname).
  const senderName = useContactStore((state) => {
    const friend = state.friendList.find((f) => f.userID === message.sendID);
    return friend?.remark || friend?.nickname || message.senderNickname;
  });

  const showActions = !disabled && !isMultiSelectActive && hovered;
  const isTextMessage =
    message.contentType === MessageType.TextMessage || isDigitalTwin || isAgentStream;

  const copyMessage = () => {
    if (!isTextMessage) return;
    const text = isDigitalTwin
      ? extractDigitalTwinText(message)
      : isAgentStream
      ? getAgentStreamPayload(message)?.answerText || ""
      : message.textElem?.content || "";
    navigator.clipboard.writeText(text).then(
      () => feedbackToast({ msg: t("toast.copySuccess") }),
      () => feedbackToast({ msg: t("toast.copyFailed") }),
    );
  };

  const directActions = [
    {
      key: "reply",
      label: t("placeholder.reply"),
      icon: <MessageOutlined />,
      onClick: () => onReply?.(message),
    },
    {
      key: "forward",
      label: t("placeholder.forward"),
      icon: <ForwardMessageIcon />,
      onClick: () => onForward?.(message),
    },
    {
      key: "copy",
      label: t("placeholder.copy"),
      icon: <CopyOutlined />,
      onClick: copyMessage,
    },
    {
      key: "check",
      label: t("placeholder.check"),
      icon: <SelectOutlined />,
      onClick: () => onMultiSelect?.(message),
    },
    {
      key: "revoke",
      label: t("placeholder.revoke"),
      icon: <RollbackOutlined />,
      onClick: () => onRevoke?.(message),
    },
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
          <OIMAvatar size={36} src={message.senderFaceUrl} text={senderName} />

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
                <div
                  className={styles.actionToolbar}
                  onClick={(e) => e.stopPropagation()}
                >
                  {directActions.map((action) => (
                    <Tooltip key={action.key} title={action.label} placement="top">
                      <button
                        type="button"
                        aria-label={action.label}
                        className={styles.actionButton}
                        onClick={action.onClick}
                      >
                        {action.icon}
                      </button>
                    </Tooltip>
                  ))}
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
