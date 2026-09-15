/* eslint-disable react/prop-types */
import {
  CloseOutlined,
  CopyOutlined,
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SaveOutlined,
  SwapOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { MergeElem, MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { Image, Modal, Tooltip } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import OIMAvatar from "@/components/OIMAvatar";
import { feedbackToast } from "@/utils/common";
import { inferDownloadFileName } from "@/utils/downloadFileName";
import { downloadFileWithProgress } from "@/utils/fileDownload";
import { copyImageToClipboard } from "@/utils/imageClipboard";

import FileMessageRender from "./FileMessageRender";
import styles from "./message-item.module.scss";

interface IMergeMessageDetailModalProps {
  open: boolean;
  mergeElem?: MergeElem;
  onClose: () => void;
}

const messageBubble = "rounded-md p-2.5";
const messageBubbleOthers = `bg-[var(--chat-bubble)]`;

interface MergeImagePreviewItem {
  key: string;
  url: string;
}

const getImagePreviewUrl = (message?: MessageItem) => {
  if (message?.contentType !== MessageType.PictureMessage) return "";
  return (
    message.pictureElem?.sourcePicture?.url ||
    message.pictureElem?.snapshotPicture?.url ||
    ""
  );
};

const getMergeImagePreviewKey = (message: MessageItem, type = "image") =>
  `${message.clientMsgID || message.serverMsgID || message.sendTime}:${type}`;

const collectMergeImagePreviewItems = (messages?: MessageItem[]) => {
  const items: MergeImagePreviewItem[] = [];
  messages?.forEach((message) => {
    const imageUrl = getImagePreviewUrl(message);
    if (imageUrl) {
      items.push({ key: getMergeImagePreviewKey(message), url: imageUrl });
    }

    const quoteImageUrl = getImagePreviewUrl(
      message.contentType === MessageType.QuoteMessage
        ? message.quoteElem?.quoteMessage
        : undefined,
    );
    if (quoteImageUrl) {
      items.push({
        key: getMergeImagePreviewKey(message, "quote"),
        url: quoteImageUrl,
      });
    }
  });
  return items;
};

const QuotePreview: FC<{ m: MessageItem; onImagePreview: () => void }> = ({
  m,
  onImagePreview,
}) => {
  switch (m.contentType) {
    case MessageType.TextMessage:
      return (
        <span className="text-xs text-[var(--sub-text)]">
          {m.textElem?.content || ""}
        </span>
      );
    case MessageType.PictureMessage: {
      const pic = m.pictureElem;
      const src = pic?.snapshotPicture?.url || pic?.sourcePicture?.url || "";
      return (
        <Image
          rootClassName="max-w-[120px] cursor-pointer overflow-hidden rounded"
          className="max-w-[120px] rounded"
          src={src}
          preview={false}
          onClick={(event) => {
            event.stopPropagation();
            onImagePreview();
          }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />
      );
    }
    case MessageType.FileMessage:
      return <FileMessageRender message={m} isSender={false} />;
    case MessageType.CardMessage:
      return (
        <span className="text-xs text-[var(--sub-text)]">
          {t("messageDescription.cardMessage")}
        </span>
      );
    case MessageType.MergeMessage:
      return (
        <span className="text-xs text-[var(--sub-text)]">
          {m.mergeElem?.title || t("messageDescription.mergeMessage")}
        </span>
      );
    default:
      return (
        <span className="text-xs text-[var(--sub-text)]">
          {t("messageDescription.catchMessage")}
        </span>
      );
  }
};

/** Render a single message item inside the merge detail modal */
const MergedMessageItem: FC<{
  message: MessageItem;
  onImagePreview: (key: string) => void;
}> = memo(({ message, onImagePreview }) => {
  const renderContent = () => {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return (
          <div
            className={clsx(
              messageBubble,
              messageBubbleOthers,
              styles.bubble,
              "select-text whitespace-pre-wrap",
            )}
          >
            {message.textElem?.content || ""}
          </div>
        );
      case MessageType.PictureMessage: {
        const pic = message.pictureElem;
        const displayUrl = pic?.snapshotPicture?.url || pic?.sourcePicture?.url || "";
        const orig = pic?.sourcePicture?.url || displayUrl;
        return (
          <div className="group relative max-w-[160px]">
            <Image
              rootClassName="message-image cursor-pointer rounded-md overflow-hidden"
              className="max-w-[160px] rounded-md"
              src={displayUrl}
              preview={false}
              onClick={(event) => {
                event.stopPropagation();
                onImagePreview(getMergeImagePreviewKey(message));
              }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
            <Tooltip title={t("placeholder.copy")}>
              <button
                type="button"
                className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
                onClick={(event) => {
                  event.stopPropagation();
                  void (async () => {
                    try {
                      await copyImageToClipboard(orig);
                      feedbackToast({ msg: t("toast.copySuccess") });
                    } catch {
                      feedbackToast({ msg: t("toast.copyFailed") });
                    }
                  })();
                }}
              >
                <CopyOutlined />
              </button>
            </Tooltip>
          </div>
        );
      }
      case MessageType.FileMessage:
        return <FileMessageRender message={message} isSender={false} />;
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

        return (
          <div
            className={clsx(messageBubble, messageBubbleOthers, "flex flex-col gap-1")}
          >
            {quoted && (
              <div className="rounded border-l-2 border-[var(--primary)] bg-[rgba(0,0,0,0.03)] px-2 py-1">
                <div className="text-xs text-[var(--primary)]">
                  {quoted.senderNickname || ""}
                </div>
                <QuotePreview
                  m={quoted}
                  onImagePreview={() =>
                    onImagePreview(getMergeImagePreviewKey(message, "quote"))
                  }
                />
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
  const [mergePreviewVisible, setMergePreviewVisible] = useState(false);
  const [mergePreviewCurrent, setMergePreviewCurrent] = useState(0);
  const [mergePreviewScale, setMergePreviewScale] = useState(1);
  const [mergePreviewRotate, setMergePreviewRotate] = useState(0);
  const [mergePreviewFlipX, setMergePreviewFlipX] = useState(false);
  const [mergePreviewFlipY, setMergePreviewFlipY] = useState(false);
  const [mergePreviewTranslate, setMergePreviewTranslate] = useState({ x: 0, y: 0 });
  const mergeImagePreviewItems = useMemo(
    () => collectMergeImagePreviewItems(mergeElem?.multiMessage),
    [mergeElem?.multiMessage],
  );
  const resetMergePreviewTransform = useCallback(() => {
    setMergePreviewScale(1);
    setMergePreviewRotate(0);
    setMergePreviewFlipX(false);
    setMergePreviewFlipY(false);
    setMergePreviewTranslate({ x: 0, y: 0 });
  }, []);
  const handleImagePreview = useCallback(
    (key: string) => {
      const current = mergeImagePreviewItems.findIndex((item) => item.key === key);
      if (current < 0) return;
      resetMergePreviewTransform();
      setMergePreviewCurrent(current);
      setMergePreviewVisible(true);
    },
    [mergeImagePreviewItems, resetMergePreviewTransform],
  );
  const handlePreviewClose = useCallback(() => {
    resetMergePreviewTransform();
    setMergePreviewVisible(false);
  }, [resetMergePreviewTransform]);
  const handlePreviewChange = useCallback(
    (next: number) => {
      resetMergePreviewTransform();
      setMergePreviewCurrent(next);
    },
    [resetMergePreviewTransform],
  );
  const handleClose = useCallback(() => {
    handlePreviewClose();
    onClose();
  }, [handlePreviewClose, onClose]);
  const currentPreviewItem = mergeImagePreviewItems[mergePreviewCurrent];
  const currentPreviewUrl = currentPreviewItem?.url || "";
  const currentPreviewFileName = inferDownloadFileName({ url: currentPreviewUrl });
  const handlePreviewDownload = useCallback(() => {
    if (!currentPreviewUrl) return;
    void downloadFileWithProgress({
      url: currentPreviewUrl,
      fileName: currentPreviewFileName,
      showProgressToast: true,
      progressTitle: t("toast.downloading"),
    }).catch((error) => {
      console.error("Merge image download failed:", error);
    });
  }, [currentPreviewFileName, currentPreviewUrl]);
  const handlePreviewSaveAs = useCallback(() => {
    const ipcInvoke = window.electronAPI?.ipcInvoke;
    if (!currentPreviewUrl || !ipcInvoke) return;
    void (async () => {
      const selectedPath = await ipcInvoke<string | false>("chooseDownloadPath", {
        fileName: currentPreviewFileName,
      });
      if (!selectedPath) return;
      await downloadFileWithProgress({
        url: currentPreviewUrl,
        fileName: currentPreviewFileName,
        filePath: selectedPath,
        showProgressToast: true,
        progressTitle: t("toast.downloading"),
      });
    })().catch((error) => {
      console.error("Merge image save as failed:", error);
    });
  }, [currentPreviewFileName, currentPreviewUrl]);

  const mergePreview =
    mergePreviewVisible && currentPreviewItem
      ? createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={handlePreviewClose}
          >
            <img
              className="max-h-[calc(100vh-112px)] max-w-[calc(100vw-112px)] select-none object-contain transition-transform duration-150"
              src={currentPreviewUrl}
              draggable={false}
              style={{
                // prettier-ignore
                transform: `translate(${mergePreviewTranslate.x}px, ${mergePreviewTranslate.y}px) rotate(${mergePreviewRotate}deg) scale(${mergePreviewScale}) scaleX(${mergePreviewFlipX ? -1 : 1}) scaleY(${mergePreviewFlipY ? -1 : 1})`,
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <Tooltip title={t("placeholder.close")}>
              <button
                type="button"
                aria-label="Close image preview"
                className="absolute right-5 top-16 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-lg text-white transition hover:bg-white/15"
                onClick={(event) => {
                  event.stopPropagation();
                  handlePreviewClose();
                }}
              >
                <CloseOutlined />
              </button>
            </Tooltip>
            {mergeImagePreviewItems.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  disabled={mergePreviewCurrent === 0}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-xl text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-25"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePreviewChange(Math.max(0, mergePreviewCurrent - 1));
                  }}
                >
                  <LeftOutlined />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  disabled={mergePreviewCurrent === mergeImagePreviewItems.length - 1}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-xl text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-25"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePreviewChange(
                      Math.min(
                        mergeImagePreviewItems.length - 1,
                        mergePreviewCurrent + 1,
                      ),
                    );
                  }}
                >
                  <RightOutlined />
                </button>
              </>
            )}
            <div
              className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-3 py-2 text-white"
              onClick={(event) => event.stopPropagation()}
            >
              <Tooltip title="Flip horizontally">
                <button
                  type="button"
                  aria-label="Flip horizontally"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() => setMergePreviewFlipX((flipped) => !flipped)}
                >
                  <SwapOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Flip vertically">
                <button
                  type="button"
                  aria-label="Flip vertically"
                  className="flex h-8 w-8 rotate-90 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() => setMergePreviewFlipY((flipped) => !flipped)}
                >
                  <SwapOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Rotate left">
                <button
                  type="button"
                  aria-label="Rotate left"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() => setMergePreviewRotate((rotate) => rotate - 90)}
                >
                  <RotateLeftOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Rotate right">
                <button
                  type="button"
                  aria-label="Rotate right"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() => setMergePreviewRotate((rotate) => rotate + 90)}
                >
                  <RotateRightOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Zoom out">
                <button
                  type="button"
                  aria-label="Zoom out"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() =>
                    setMergePreviewScale((scale) => Math.max(0.25, scale - 0.25))
                  }
                >
                  <ZoomOutOutlined />
                </button>
              </Tooltip>
              <Tooltip title="Zoom in">
                <button
                  type="button"
                  aria-label="Zoom in"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={() =>
                    setMergePreviewScale((scale) => Math.min(5, scale + 0.25))
                  }
                >
                  <ZoomInOutlined />
                </button>
              </Tooltip>
              <Tooltip title={t("placeholder.download")}>
                <button
                  type="button"
                  aria-label="Download image"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={handlePreviewDownload}
                >
                  <DownloadOutlined />
                </button>
              </Tooltip>
              <Tooltip title={t("placeholder.saveAs")}>
                <button
                  type="button"
                  aria-label="Save image as"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-white/15"
                  onClick={handlePreviewSaveAs}
                >
                  <SaveOutlined />
                </button>
              </Tooltip>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (!mergeElem) return null;
  const { title, multiMessage } = mergeElem;

  return (
    <>
      {mergePreview}
      <Modal
        title={null}
        footer={null}
        centered
        open={open}
        closable={false}
        width={520}
        onCancel={handleClose}
        destroyOnClose
        styles={{ mask: { opacity: 0, transition: "none" } }}
        className="no-padding-modal max-w-[90vw]"
        maskTransitionName=""
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--gap-text)] px-5">
          <div
            className="truncate text-base font-medium text-[var(--primary-text)]"
            title={title}
          >
            {title || t("messageDescription.mergeMessage")}
          </div>
          <CloseOutlined
            className="ml-3 shrink-0 cursor-pointer text-[var(--sub-text)]"
            rev={undefined}
            onClick={handleClose}
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto py-4">
          {multiMessage?.length ? (
            multiMessage.map((msg) => (
              <MergedMessageItem
                key={msg.clientMsgID}
                message={msg}
                onImagePreview={handleImagePreview}
              />
            ))
          ) : (
            <div className="px-4 py-10 text-center text-[var(--sub-text)]">
              {t("messageDescription.catchMessage")}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default memo(MergeMessageDetailModal);
