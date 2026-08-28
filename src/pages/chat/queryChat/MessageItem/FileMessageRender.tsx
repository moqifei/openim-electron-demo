import { DownloadOutlined, FileOutlined } from "@ant-design/icons";
import { MessageStatus } from "@openim/wasm-client-sdk";
import { Progress } from "antd";
import { t } from "i18next";
import { FC, useCallback, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { bytesToSize } from "@/utils/common";
import { downloadFileWithProgress } from "@/utils/fileDownload";
import { getFileTransferErrorMessage } from "@/utils/fileTransferError";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

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

const FileMessageRender: FC<IMessageItemProps> = ({ message, isSender }) => {
  const fileElem = message.fileElem;
  const sourceUrl = fileElem?.sourceUrl || "";
  const isSending = message.status === MessageStatus.Sending;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localFilePath, setLocalFilePath] = useState(
    () => downloadedFilePathCache.get(sourceUrl) || "",
  );

  const downloadFile = useCallback(
    async (filePath?: string) => {
      if (!sourceUrl || isSending || isDownloading) return;

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
        });
        if (savedPath) {
          setLocalFilePath(savedPath);
          downloadedFilePathCache.set(sourceUrl, savedPath);
        }
      } catch (error) {
        console.error("[FileMessageRender] download failed:", error);
        antdMessage.error(getFileTransferErrorMessage(error, "download"));
      } finally {
        setIsDownloading(false);
      }
    },
    [fileElem?.fileName, fileElem?.fileSize, isDownloading, isSending, sourceUrl],
  );

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

  const handleOpen = useCallback(async () => {
    if (!localFilePath || !window.electronAPI?.openLocalPath) return;
    const openError = await window.electronAPI.openLocalPath(localFilePath);
    if (openError) {
      setLocalFilePath("");
      downloadedFilePathCache.delete(sourceUrl);
      antdMessage.error(getFileTransferErrorMessage(openError, "download"));
    }
  }, [localFilePath, sourceUrl]);

  const handleOpenFolder = useCallback(async () => {
    if (!localFilePath || !window.electronAPI?.ipcInvoke) return;
    const openError = await window.electronAPI.ipcInvoke<string>(
      "openLocalFolder",
      localFilePath,
    );
    if (openError) {
      setLocalFilePath("");
      downloadedFilePathCache.delete(sourceUrl);
      antdMessage.error(getFileTransferErrorMessage(openError, "download"));
    }
  }, [localFilePath, sourceUrl]);

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
            <div className="mt-1 w-[180px]">
              <Progress percent={downloadProgress} size="small" showInfo />
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
              <FileActionButton label={t("placeholder.open")} onClick={handleOpen} />
              <FileActionButton
                label={t("placeholder.openFolder")}
                onClick={handleOpenFolder}
              />
              <FileActionButton
                label={t("placeholder.redownload")}
                onClick={() => void downloadFile()}
              />
            </>
          ) : (
            <>
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
