import { DownloadOutlined, FileOutlined } from "@ant-design/icons";
import { MessageItem, MessageStatus } from "@openim/wasm-client-sdk";
import { Progress } from "antd";
import { t } from "i18next";
import { FC, useCallback, useEffect, useRef, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { bytesToSize } from "@/utils/common";
import {
  downloadFileWithProgress,
  isDownloadCancelledError,
} from "@/utils/fileDownload";
import { getFileTransferErrorMessage } from "@/utils/fileTransferError";

import styles from "./message-item.module.scss";

interface FileMessageRenderProps {
  message: MessageItem;
  isSender: boolean;
}

interface FileActionButtonProps {
  label: string;
  onClick: () => void;
}

const FileActionButton: FC<FileActionButtonProps> = ({ label, onClick }) => (
  <button
    type="button"
    className="border-0 bg-transparent p-0 text-xs text-[var(--primary)] hover:opacity-80"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    {label}
  </button>
);

const downloadedFilePathCache = new Map<string, string>();

const FileMessageRender: FC<FileMessageRenderProps> = ({ message, isSender }) => {
  const fileElem = message.fileElem;
  const sourceUrl = fileElem?.sourceUrl || "";
  const downloadCacheKey = message.clientMsgID || message.serverMsgID || sourceUrl;
  const isSending = message.status === MessageStatus.Sending;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localFilePath, setLocalFilePath] = useState(
    () => downloadedFilePathCache.get(downloadCacheKey) || "",
  );
  const downloadAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLocalFilePath(downloadedFilePathCache.get(downloadCacheKey) || "");
  }, [downloadCacheKey]);

  const downloadFile = useCallback(
    async (filePath?: string) => {
      if (!sourceUrl || isSending || isDownloading) return;

      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        const savedPath = await downloadFileWithProgress({
          url: sourceUrl,
          fileName: fileElem?.fileName,
          filePath,
          knownSize: fileElem?.fileSize,
          onProgress: setDownloadProgress,
          showProgressToast: true,
          progressTitle: t("toast.downloading"),
          signal: controller.signal,
          onCancel: () => controller.abort(),
        });
        if (savedPath) {
          setLocalFilePath(savedPath);
          downloadedFilePathCache.set(downloadCacheKey, savedPath);
        }
        return savedPath;
      } catch (error) {
        if (isDownloadCancelledError(error)) return;
        console.error("[FileMessageRender] download failed:", error);
        antdMessage.error(getFileTransferErrorMessage(error, "download"));
      } finally {
        if (downloadAbortControllerRef.current === controller) {
          downloadAbortControllerRef.current = null;
        }
        setIsDownloading(false);
      }
    },
    [
      downloadCacheKey,
      fileElem?.fileName,
      fileElem?.fileSize,
      isDownloading,
      isSending,
      sourceUrl,
    ],
  );

  const cancelDownload = useCallback(() => {
    downloadAbortControllerRef.current?.abort();
  }, []);

  const handleSaveAs = useCallback(async () => {
    if (!sourceUrl || isSending || isDownloading) return;
    if (!window.electronAPI?.ipcInvoke) {
      void downloadFile();
      return;
    }

    const selectedPath = await window.electronAPI.ipcInvoke<string | false>(
      "chooseDownloadPath",
      { fileName: fileElem?.fileName },
    );
    if (!selectedPath) return;
    await downloadFile(selectedPath);
  }, [downloadFile, fileElem?.fileName, isDownloading, isSending, sourceUrl]);

  const openDownloadedFile = useCallback(
    async (filePath: string) => {
      if (!filePath || !window.electronAPI?.openLocalPath) return;
      const openError = await window.electronAPI.openLocalPath(filePath);
      if (openError) {
        setLocalFilePath("");
        downloadedFilePathCache.delete(downloadCacheKey);
        antdMessage.error(getFileTransferErrorMessage(openError, "download"));
      }
    },
    [downloadCacheKey],
  );

  const handleOpen = useCallback(
    () => openDownloadedFile(localFilePath),
    [localFilePath, openDownloadedFile],
  );

  const handleDownloadAndOpen = useCallback(async () => {
    const savedPath = await downloadFile();
    if (savedPath) await openDownloadedFile(savedPath);
  }, [downloadFile, openDownloadedFile]);

  const handleOpenFolder = useCallback(async () => {
    if (!localFilePath || !window.electronAPI?.ipcInvoke) return;
    const openError = await window.electronAPI.ipcInvoke<string>(
      "openLocalFolder",
      localFilePath,
    );
    if (openError) {
      setLocalFilePath("");
      downloadedFilePathCache.delete(downloadCacheKey);
      antdMessage.error(getFileTransferErrorMessage(openError, "download"));
    }
  }, [downloadCacheKey, localFilePath, sourceUrl]);

  return (
    <div
      className={`${
        styles.bubble
      } flex max-w-[260px] flex-col !overflow-hidden !rounded-lg !border-[var(--border-color)] !px-0 !py-0 ${
        isSender ? "!bg-[var(--chat-bubble-sender)]" : "!bg-[var(--bg-base)]"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <FileOutlined className="shrink-0 text-xl text-[var(--primary)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm" title={fileElem?.fileName}>
            {fileElem?.fileName}
          </div>
          {isDownloading ? (
            <div className="mt-1 flex w-[180px] items-center gap-2">
              <Progress percent={downloadProgress} size="small" showInfo />
              <FileActionButton label={t("cancel")} onClick={cancelDownload} />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-[var(--sub-text)]">
              {isSending ? (
                "Sending..."
              ) : (
                <>
                  <span>{bytesToSize(fileElem?.fileSize ?? 0)}</span>
                  <DownloadOutlined className="text-[var(--primary)]" />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!isSending && !isDownloading && (
        <div className="flex items-center gap-3 border-t border-[var(--border-color)] px-3 py-1.5">
          {localFilePath ? (
            <>
              <FileActionButton
                label={t("placeholder.open")}
                onClick={() => {
                  void handleOpen();
                }}
              />
              <FileActionButton
                label={t("placeholder.openFolder")}
                onClick={() => {
                  void handleOpenFolder();
                }}
              />
              <FileActionButton
                label={t("placeholder.saveAs")}
                onClick={() => void handleSaveAs()}
              />
            </>
          ) : (
            <>
              <FileActionButton
                label={t("placeholder.open")}
                onClick={() => void handleDownloadAndOpen()}
              />
              <FileActionButton
                label={t("placeholder.save")}
                onClick={() => void downloadFile()}
              />
              <FileActionButton
                label={t("placeholder.saveAs")}
                onClick={() => void handleSaveAs()}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FileMessageRender;
