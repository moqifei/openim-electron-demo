import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import clsx from "clsx";
import { t } from "i18next";
import { FC, useCallback } from "react";

import { IMessageItemProps } from "./index";
import styles from "./message-item.module.scss";

const QuoteMessageRender: FC<
  Omit<
    IMessageItemProps,
    | "isMultiSelectActive"
    | "isSelected"
    | "onToggleSelect"
    | "onForward"
    | "onReply"
    | "onMultiSelect"
    | "onRevoke"
  >
> = ({ message, isSender, onQuoteMessage }) => {
  const quoteElem = message.quoteElem;
  const text =
    quoteElem?.text ||
    message.textElem?.content ||
    message.advancedTextElem?.text ||
    "";
  const quoteMessage = quoteElem?.quoteMessage;

  const getQuoteContent = (msg: MessageItem): string => {
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
      case MessageType.QuoteMessage: {
        const nestedMessage = msg.quoteElem?.quoteMessage;
        return nestedMessage
          ? `${t("messageDescription.quoteMessage")} ${getQuoteContent(nestedMessage)}`
          : t("messageDescription.quoteMessage");
      }
      default:
        return t("messageDescription.catchMessage");
    }
  };

  const jumpToOriginal = useCallback(
    async (originalMsg: MessageItem) => {
      if (onQuoteMessage) {
        await onQuoteMessage(originalMsg);
        return;
      }

      if (!originalMsg.clientMsgID) return;

      const el = document.getElementById(`chat_${originalMsg.clientMsgID}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("animate-pulse");
      setTimeout(() => el.classList.remove("animate-pulse"), 2000);
    },
    [onQuoteMessage],
  );

  const handleQuoteClick = useCallback(
    async (e: React.MouseEvent) => {
      if (!quoteMessage) return;

      if (quoteMessage.contentType === MessageType.PictureMessage) {
        e.stopPropagation();
        await jumpToOriginal(quoteMessage);
        return;
      }

      if (quoteMessage.contentType === MessageType.FileMessage) {
        e.stopPropagation();
        await jumpToOriginal(quoteMessage);
        return;
      }

      await jumpToOriginal(quoteMessage);
    },
    [quoteMessage, jumpToOriginal],
  );

  if (!quoteElem) return null;

  const imageUrl =
    quoteMessage?.pictureElem?.sourcePicture?.url ||
    quoteMessage?.pictureElem?.snapshotPicture?.url ||
    "";

  return (
    <div
      className={clsx(
        styles.quoteMessageBubble,
        isSender && styles.quoteMessageBubbleSender,
      )}
    >
      {quoteMessage && (
        <>
          <div className={styles.quoteMessageReference} onClick={handleQuoteClick}>
            {quoteMessage.contentType === MessageType.PictureMessage && imageUrl && (
              <img
                className="quote-message-image mr-2 inline-block h-10 w-10 rounded object-cover align-middle"
                src={imageUrl}
                alt={t("messageDescription.imageMessage")}
              />
            )}
            <span className={styles.quoteMessageAuthor}>
              {t("placeholder.reply")} {quoteMessage.senderNickname || ""}：
            </span>
            <span className={styles.quoteMessageContent}>
              {getQuoteContent(quoteMessage)}
            </span>
          </div>
        </>
      )}
      <div className={styles.quoteMessageBody}>{text}</div>
    </div>
  );
};

export default QuoteMessageRender;
