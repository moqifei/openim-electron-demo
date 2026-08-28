import { t } from "i18next";

import { getServerUrls } from "./config";
import {
  createFileTransferProgressKey,
  showFileTransferProgress,
} from "./fileTransferProgress";
import { inferDownloadFileName } from "./downloadFileName";
import { getFileTransferErrorReason } from "./fileTransferError";

type DownloadFileOptions = {
  url: string;
  fileName?: string;
  filePath?: string;
  knownSize?: number;
  onProgress?: (progress: number) => void;
  showProgressToast?: boolean;
  progressTitle?: string;
};

const isAbsoluteUrl = (url: string) => /^(https?:|blob:|data:|file:)/i.test(url);

export const resolveFileDownloadUrl = (url: string) => {
  if (isAbsoluteUrl(url)) return url;
  return new URL(url, `${getServerUrls().apiUrl}/`).toString();
};

const saveBlob = (blob: Blob, fileName?: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName || "download";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

export const downloadFileWithProgress = async ({
  url,
  fileName,
  filePath,
  knownSize,
  onProgress,
  showProgressToast = false,
  progressTitle = "Downloading...",
}: DownloadFileOptions): Promise<string | undefined> => {
  return new Promise<string | undefined>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let downloadFileName = fileName || "download";
    const progressKey = showProgressToast
      ? createFileTransferProgressKey("file-download")
      : "";

    const updateProgress = (
      progress: number,
      status?: "active" | "success" | "exception",
      title = progressTitle,
    ) => {
      const safeProgress = Math.min(100, Math.max(0, progress));
      onProgress?.(safeProgress);
      if (!showProgressToast) return;
      showFileTransferProgress({
        key: progressKey,
        fileName: downloadFileName,
        title,
        percent: safeProgress,
        status,
      });
    };

    const failDownload = (error: unknown) => {
      const reason = getFileTransferErrorReason(error);
      const title = reason
        ? t("toast.downloadFailedWithReason", { reason })
        : t("toast.downloadFailed");
      updateProgress(100, "exception", title);
      reject(new Error(reason || t("toast.downloadFailed")));
    };

    const readResponseError = async () => {
      if (!(xhr.response instanceof Blob)) return xhr.response;

      const text = (await xhr.response.text()).trim();
      if (!text) return undefined;

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    };

    const resolvedUrl = resolveFileDownloadUrl(url);
    xhr.open("GET", resolvedUrl, true);
    xhr.responseType = "blob";

    updateProgress(0);

    xhr.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : knownSize;
      if (!total) return;
      const progress = Math.round((event.loaded / total) * 100);
      updateProgress(Math.min(99, Math.max(0, progress)));
    };

    xhr.onload = async () => {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        try {
          downloadFileName = inferDownloadFileName({
            fileName,
            contentDisposition: xhr.getResponseHeader("Content-Disposition"),
            url: resolvedUrl,
            mimeType: xhr.response?.type,
          });

          const electronAPI = window.electronAPI;
          if (electronAPI?.saveDownloadedFile) {
            const savedPath = await electronAPI.saveDownloadedFile({
              data: await xhr.response.arrayBuffer(),
              fileName: downloadFileName,
              filePath,
            });
            if (!savedPath) {
              failDownload(new Error("Target file path is invalid"));
              return;
            }
            updateProgress(100, "success");
            resolve(savedPath);
            return;
          } else {
            saveBlob(xhr.response, downloadFileName);
          }
          updateProgress(100, "success");
          resolve(undefined);
        } catch (error) {
          failDownload(error);
        }
        return;
      }
      const responseError = await readResponseError();
      failDownload(responseError || new Error(`HTTP ${xhr.status}`));
    };

    xhr.onerror = () => {
      failDownload(new Error("Network error"));
    };
    xhr.onabort = () => {
      failDownload(new Error("Download aborted"));
    };
    xhr.send();
  });
};
