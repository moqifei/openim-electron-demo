import { getServerUrls } from "./config";
import {
  createFileTransferProgressKey,
  showFileTransferProgress,
} from "./fileTransferProgress";
import { inferDownloadFileName } from "./downloadFileName";

type DownloadFileOptions = {
  url: string;
  fileName?: string;
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

export const downloadFileWithProgress = ({
  url,
  fileName,
  knownSize,
  onProgress,
  showProgressToast = false,
  progressTitle = "Downloading...",
}: DownloadFileOptions) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let downloadFileName = fileName || "download";
    const progressKey = showProgressToast
      ? createFileTransferProgressKey("file-download")
      : "";

    const updateProgress = (
      progress: number,
      status?: "active" | "success" | "exception",
    ) => {
      const safeProgress = Math.min(100, Math.max(0, progress));
      onProgress?.(safeProgress);
      if (!showProgressToast) return;
      showFileTransferProgress({
        key: progressKey,
        fileName: downloadFileName,
        title: progressTitle,
        percent: safeProgress,
        status,
      });
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
            await electronAPI.saveDownloadedFile({
              data: await xhr.response.arrayBuffer(),
              fileName: downloadFileName,
            });
          } else {
            saveBlob(xhr.response, downloadFileName);
          }
          updateProgress(100, "success");
          resolve();
        } catch (error) {
          updateProgress(100, "exception");
          reject(error);
        }
        return;
      }
      updateProgress(100, "exception");
      reject(new Error(`Download failed with status ${xhr.status}`));
    };

    xhr.onerror = () => {
      updateProgress(100, "exception");
      reject(new Error("Download failed"));
    };
    xhr.onabort = () => {
      updateProgress(100, "exception");
      reject(new Error("Download aborted"));
    };
    xhr.send();
  });
