import { DownloadOutlined, FileOutlined } from "@ant-design/icons";
import { MessageStatus } from "@openim/wasm-client-sdk";
import { Progress } from "antd";
import { t } from "i18next";
import { FC, useCallback, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { bytesToSize } from "@/utils/common";
import { downloadFileWithProgress } from "@/utils/fileDownload";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const FileMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const fileElem = message.fileElem;
  const isSending = message.status === MessageStatus.Sending;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = useCallback(async () => {
    if (!fileElem?.sourceUrl || isSending || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadFileWithProgress({
        url: fileElem.sourceUrl,
        fileName: fileElem.fileName,
        knownSize: fileElem.fileSize,
        onProgress: setDownloadProgress,
        showProgressToast: true,
        progressTitle: t("toast.downloading"),
      });
    } catch (error) {
      console.error("[FileMessageRender] download failed:", error);
      antdMessage.error(t("toast.downloadFailed"));
    } finally {
      setIsDownloading(false);
    }
  }, [
    fileElem?.sourceUrl,
    fileElem?.fileName,
    fileElem?.fileSize,
    isSending,
    isDownloading,
  ]);

  return (
    <div
      className={`${
        styles.bubble
      } flex max-w-[260px] cursor-pointer items-center gap-3 !rounded-lg !border-[var(--border-color)] !bg-[var(--bg-base)] px-3 py-2 ${
        isSending || isDownloading ? "" : "hover:opacity-80"
      }`}
      onClick={() => {
        void handleDownload();
      }}
      title={
        isSending || isDownloading
          ? undefined
          : `Click to download ${fileElem?.fileName}`
      }
    >
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
  );
};

export default FileMessageRender;
