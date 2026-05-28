import { CloseOutlined, FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { MessageItem, MessageType, MergeElem } from "@openim/wasm-client-sdk";
import { Image, Modal } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { formatBr } from "@/utils/common";

import styles from "./message-item.module.scss";

interface IMergeMessageDetailModalProps {
  open: boolean;
  mergeElem?: MergeElem;
  onClose: () => void;
}

const messageBubble = "rounded-md p-2.5";
const messageBubbleOthers = `bg-[var(--chat-bubble)]`;

/** Render a single message item inside the merge detail modal */
const MergedMessageItem: FC<{ message: MessageItem }> = memo(({ message }) => {
  const renderContent = () => {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return (
          <div
            className={clsx(messageBubble, messageBubbleOthers, styles.bubble)}
            dangerouslySetInnerHTML={{
              __html: formatBr(message.textElem?.content || ""),
            }}
          />
        );
      case MessageType.PictureMessage: {
        const pic = message.pictureElem;
        const src = pic?.snapshotPicture?.url || pic?.sourcePicture?.url || "";
        const orig = pic?.sourcePicture?.url || src;
        return (
          <div className="max-w-[160px]">
            <Image
              rootClassName="message-image cursor-pointer rounded-md overflow-hidden"
              className="max-w-[160px] rounded-md"
              src={src}
              preview={{ src: orig }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          </div>
        );
      }
      case MessageType.FileMessage: {
        const file = message.fileElem;
        return (
          <div
            className={clsx(
              messageBubble,
              messageBubbleOthers,
              "flex cursor-pointer items-center gap-3 px-3 py-2 hover:opacity-80",
            )}
            onClick={() => {
              if (!file?.sourceUrl) return;
              const a = document.createElement("a");
              a.href = file.sourceUrl;
              a.download = file.fileName || "download";
              a.target = "_blank";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
            <FileOutlined className="shrink-0 text-xl text-[var(--primary)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm" title={file?.fileName}>
                {file?.fileName}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--sub-text)]">
                <DownloadOutlined className="text-[var(--primary)]" />
              </div>
            </div>
          </div>
        );
      }
      case MessageType.CardMessage: {
        const card = message.cardElem;
        return (
          <div
            className={clsx(
              messageBubble,
              messageBubbleOthers,
              "flex items-center gap-3 px-3 py-2",
            )}
          >
            <OIMAvatar size={40} src={card?.faceURL} text={card?.nickname} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" title={card?.nickname}>
                {card?.nickname}
              </div>
              <div className="mt-0.5 text-xs text-[var(--sub-text)]">
                {t("placeholder.personalCard")}
              </div>
            </div>
          </div>
        );
      }
      case MessageType.MergeMessage:
        return (
          <div className={clsx(messageBubble, messageBubbleOthers)}>
            <div className="text-sm font-medium text-[var(--primary-text)]">
              {message.mergeElem?.title}
            </div>
          </div>
        );
      case MessageType.QuoteMessage: {
        const quoteElem = message.quoteElem;
        const quoted = quoteElem?.quoteMessage;

        const QuotePreview: FC<{ m: MessageItem }> = ({ m }) => {
          const [previewVisible, setPreviewVisible] = useState(false);

          switch (m.contentType) {
            case MessageType.TextMessage:
              return <span className="text-xs text-[var(--sub-text)]">{m.textElem?.content || ""}</span>;
            case MessageType.PictureMessage: {
              const pic = m.pictureElem;
              const src = pic?.snapshotPicture?.url || pic?.sourcePicture?.url || "";
              const orig = pic?.sourcePicture?.url || src;
              return (
                <>
                  <Image
                    className="hidden"
                    src={src}
                    preview={{ visible: previewVisible, onVisibleChange: setPreviewVisible, src: orig }}
                  />
                  <div
                    className="max-w-[120px] cursor-pointer overflow-hidden rounded"
                    onClick={() => setPreviewVisible(true)}
                  >
                    <img
                      src={src}
                      className="max-w-[120px] rounded"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </>
              );
            }
            case MessageType.FileMessage: {
              const file = m.fileElem;
              return (
                <div
                  className="flex cursor-pointer items-center gap-2 hover:opacity-80"
                  onClick={() => {
                    if (!file?.sourceUrl) return;
                    const a = document.createElement("a");
                    a.href = file.sourceUrl;
                    a.download = file.fileName || "download";
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <FileOutlined className="shrink-0 text-base text-[var(--primary)]" />
                  <span className="truncate text-xs text-[var(--sub-text)]">{file?.fileName}</span>
                </div>
              );
            }
            case MessageType.CardMessage:
              return <span className="text-xs text-[var(--sub-text)]">{t("messageDescription.cardMessage")}</span>;
            case MessageType.MergeMessage:
              return <span className="text-xs text-[var(--sub-text)]">{m.mergeElem?.title || t("messageDescription.mergeMessage")}</span>;
            default:
              return <span className="text-xs text-[var(--sub-text)]">{t("messageDescription.catchMessage")}</span>;
          }
        };

        return (
          <div className={clsx(messageBubble, messageBubbleOthers, "flex flex-col gap-1")}>
            {quoted && (
              <div className="rounded border-l-2 border-[var(--primary)] bg-[rgba(0,0,0,0.03)] px-2 py-1">
                <div className="text-xs text-[var(--primary)]">
                  {quoted.senderNickname || ""}
                </div>
                <QuotePreview m={quoted} />
              </div>
            )}
            <div className="whitespace-pre-wrap break-all text-[var(--primary-text)]">
              {quoteElem?.text}
            </div>
          </div>
        );
      }
      default:
        return (
          <div className={clsx(messageBubble, messageBubbleOthers)}>
            <span className="text-sm text-[var(--sub-text)]">
              {t("messageDescription.catchMessage")}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="mb-3 flex flex-col px-4">
      <div className="mb-1 text-xs text-[var(--sub-text)]">
        {message.senderNickname}
      </div>
      {renderContent()}
    </div>
  );
});

const MergeMessageDetailModal: FC<IMergeMessageDetailModalProps> = ({
  open,
  mergeElem,
  onClose,
}) => {
  if (!mergeElem) return null;
  const { title, multiMessage } = mergeElem;

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={open}
      closable={false}
      width={520}
      onCancel={onClose}
      destroyOnClose
      styles={{ mask: { opacity: 0, transition: "none" } }}
      className="no-padding-modal max-w-[90vw]"
      maskTransitionName=""
    >
      <div className="flex h-14 items-center justify-between border-b border-[var(--gap-text)] px-5">
        <div className="truncate text-base font-medium text-[var(--primary-text)]" title={title}>
          {title || t("messageDescription.mergeMessage")}
        </div>
        <CloseOutlined
          className="ml-3 shrink-0 cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={onClose}
        />
      </div>
      <div className="max-h-[70vh] overflow-y-auto py-4">
        {multiMessage?.length ? (
          multiMessage.map((msg) => (
            <MergedMessageItem key={msg.clientMsgID} message={msg} />
          ))
        ) : (
          <div className="px-4 py-10 text-center text-[var(--sub-text)]">
            {t("messageDescription.catchMessage")}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default memo(MergeMessageDetailModal);
