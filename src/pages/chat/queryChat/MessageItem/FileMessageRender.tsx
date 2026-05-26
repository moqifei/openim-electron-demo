import { MessageStatus } from "@openim/wasm-client-sdk";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { FC, useCallback } from "react";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const FileMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const fileElem = message.fileElem;
  const isSending = message.status === MessageStatus.Sending;

  const handleDownload = useCallback(() => {
    if (!fileElem?.sourceUrl || isSending) return;
    const a = document.createElement("a");
    a.href = fileElem.sourceUrl;
    a.download = fileElem.fileName || "";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [fileElem?.sourceUrl, fileElem?.fileName, isSending]);

  return (
    <div
      className={`${styles.bubble} flex max-w-[240px] cursor-pointer items-center gap-3 px-3 py-2 ${
        isSending ? "" : "hover:opacity-80"
      }`}
      onClick={handleDownload}
      title={isSending ? undefined : `Click to download ${fileElem?.fileName}`}
    >
      <FileOutlined className="shrink-0 text-xl text-[var(--primary)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm" title={fileElem?.fileName}>
          {fileElem?.fileName}
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--sub-text)]">
          {isSending ? (
            "Sending..."
          ) : (
            <>
              <span>{formatFileSize(fileElem?.fileSize ?? 0)}</span>
              <DownloadOutlined className="text-[var(--primary)]" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileMessageRender;
