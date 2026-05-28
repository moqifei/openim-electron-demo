import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { Image } from "antd";
import { FC, useCallback, useState } from "react";

import { t } from "i18next";
import { IMessageItemProps } from "./index";

const QuoteMessageRender: FC<Omit<IMessageItemProps, "isMultiSelectActive" | "isSelected" | "onToggleSelect" | "onForward" | "onReply" | "onMultiSelect" | "onDelete">> = ({
  message,
}) => {
  const quoteElem = message.quoteElem;
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  if (!quoteElem) return null;

  const { text, quoteMessage } = quoteElem;

  const getQuoteContent = (msg: MessageItem) => {
    switch (msg.contentType) {
      case MessageType.TextMessage:
        return msg.textElem?.content || "";
      case MessageType.PictureMessage:
        return t("messageDescription.imageMessage");
      case MessageType.FileMessage:
        return t("messageDescription.fileMessage", { file: msg.fileElem?.fileName || "" });
      case MessageType.CardMessage:
        return t("messageDescription.cardMessage");
      case MessageType.MergeMessage:
        return msg.mergeElem?.title || t("messageDescription.mergeMessage");
      default:
        return t("messageDescription.catchMessage");
    }
  };

  const jumpToOriginal = useCallback((originalMsg: MessageItem) => {
    if (!originalMsg.clientMsgID) return;
    const el = document.getElementById(`chat_${originalMsg.clientMsgID}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-pulse");
    setTimeout(() => el.classList.remove("animate-pulse"), 2000);
  }, []);

  const handleQuoteClick = useCallback(
    (e: React.MouseEvent) => {
      if (!quoteMessage) return;

      if (quoteMessage.contentType === MessageType.PictureMessage) {
        e.stopPropagation();
        setImagePreviewVisible(true);
        return;
      }

      if (quoteMessage.contentType === MessageType.FileMessage) {
        e.stopPropagation();
        const fileElem = quoteMessage.fileElem;
        if (fileElem?.sourceUrl) {
          const a = document.createElement("a");
          a.href = fileElem.sourceUrl;
          a.download = fileElem.fileName || "";
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        return;
      }

      jumpToOriginal(quoteMessage);
    },
    [quoteMessage, jumpToOriginal],
  );

  const imageUrl =
    quoteMessage?.pictureElem?.sourcePicture?.url ||
    quoteMessage?.pictureElem?.snapshotPicture?.url ||
    "";

  return (
    <div className="flex flex-col gap-1">
      {quoteMessage && (
        <>
          {quoteMessage.contentType === MessageType.PictureMessage && imageUrl && (
            <Image
              className="hidden"
              src={imageUrl}
              preview={{
                visible: imagePreviewVisible,
                onVisibleChange: setImagePreviewVisible,
              }}
            />
          )}
          <div
            className="cursor-pointer rounded border-l-2 border-[var(--primary)] bg-[rgba(0,0,0,0.03)] px-2 py-1 hover:bg-[rgba(0,0,0,0.06)]"
            onClick={handleQuoteClick}
          >
            <div className="text-xs text-[var(--primary)]">
              {quoteMessage.senderNickname || ""}
            </div>
            <div className="truncate text-xs text-[var(--sub-text)]">
              {getQuoteContent(quoteMessage)}
            </div>
          </div>
        </>
      )}
      <div className="whitespace-pre-wrap break-all text-[var(--primary-text)]">
        {text}
      </div>
    </div>
  );
};

export default QuoteMessageRender;
