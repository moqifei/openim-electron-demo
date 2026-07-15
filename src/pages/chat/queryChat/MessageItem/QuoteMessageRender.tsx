import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { Image } from "antd";
import { t } from "i18next";
import { FC, useCallback, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { downloadFileWithProgress } from "@/utils/fileDownload";

import { IMessageItemProps } from "./index";

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
> = ({ message }) => {
  const quoteElem = message.quoteElem;
  const text = quoteElem?.text;
  const quoteMessage = quoteElem?.quoteMessage;
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  const getQuoteContent = (msg: MessageItem) => {
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

  const jumpToOriginal = useCallback((originalMsg: MessageItem) => {
    if (!originalMsg.clientMsgID) return;
    const el = document.getElementById(`chat_${originalMsg.clientMsgID}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-pulse");
    setTimeout(() => el.classList.remove("animate-pulse"), 2000);
  }, []);

  const handleQuoteClick = useCallback(
    async (e: React.MouseEvent) => {
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
          try {
            await downloadFileWithProgress({
              url: fileElem.sourceUrl,
              fileName: fileElem.fileName || "download",
              knownSize: fileElem.fileSize,
              showProgressToast: true,
              progressTitle: t("toast.downloading"),
            });
          } catch (error) {
            console.error("[QuoteMessageRender] download failed:", error);
            antdMessage.error(t("toast.downloadFailed"));
          }
        }
        return;
      }

      jumpToOriginal(quoteMessage);
    },
    [quoteMessage, jumpToOriginal],
  );

  if (!quoteElem) return null;

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
            className="cursor-pointer rounded-md border-l-[3px] border-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-1.5 hover:bg-[rgba(51,112,255,0.12)]"
            onClick={handleQuoteClick}
          >
            <div className="text-xs text-[var(--primary)]">
              {quoteMessage.senderNickname || ""}
            </div>
            <div className="truncate text-xs text-[var(--text-tertiary)]">
              {getQuoteContent(quoteMessage)}
            </div>
          </div>
        </>
      )}
      <div className="whitespace-pre-wrap break-all text-[var(--text-primary)]">
        {text}
      </div>
    </div>
  );
};

export default QuoteMessageRender;
