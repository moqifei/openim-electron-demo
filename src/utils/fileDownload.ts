import { t } from "i18next";

import { getServerUrls } from "./config";
import {
  createFileTransferProgressKey,
  showFileTransferProgress,
} from "./fileTransferProgress";
import { inferDownloadFileName } from "./downloadFileName";
import { getFileTransferErrorReason } from "./fileTransferError";
import {
  getDownloadErrorDiagnostics,
  getDownloadUrlLogDetails,
  getDownloadXhrDiagnostics,
} from "./fileDownloadDiagnostics";

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
    let latestProgress: ProgressEvent | undefined;
    let lastLoggedProgress = -1;
    let lastLoggedLoaded = -1;
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
      console.error("[fileDownload] failed", {
        error: getDownloadErrorDiagnostics(error),
        xhr: getDownloadXhrDiagnostics(
          xhr,
          latestProgress,
          knownSize,
          typeof navigator !== "undefined" ? navigator.onLine : undefined,
        ),
        request: getDownloadUrlLogDetails(resolvedUrl),
        fileName: downloadFileName,
        fileSize: knownSize ?? 0,
      });
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
    console.info("[fileDownload] start", {
      request: getDownloadUrlLogDetails(resolvedUrl),
      fileName: fileName || "",
      fileSize: knownSize ?? 0,
      authHeader: "not-set",
    });
    xhr.open("GET", resolvedUrl, true);
    xhr.responseType = "blob";

    xhr.onloadstart = () => {
      console.info("[fileDownload] loadstart", {
        request: getDownloadUrlLogDetails(resolvedUrl),
      });
    };

    xhr.onreadystatechange = () => {
      console.info("[fileDownload] ready-state", {
        readyState: xhr.readyState,
        status: xhr.status,
      });
    };

    updateProgress(0);

    xhr.onprogress = (event) => {
      latestProgress = event;
      const total = event.lengthComputable ? event.total : knownSize;
      const progress = total ? Math.round((event.loaded / total) * 100) : -1;
      const shouldLogProgress =
        progress === 100 ||
        (progress >= 0 && progress - lastLoggedProgress >= 10) ||
        (progress < 0 &&
          (lastLoggedLoaded < 0 || event.loaded - lastLoggedLoaded >= 1024 * 1024));
      if (shouldLogProgress) {
        console.info("[fileDownload] progress", {
          loaded: event.loaded,
          total: total ?? 0,
          lengthComputable: event.lengthComputable,
          percent: progress,
        });
        lastLoggedProgress = progress;
        lastLoggedLoaded = event.loaded;
      }
      if (!total) return;
      updateProgress(Math.min(99, Math.max(0, progress)));
    };

    xhr.onload = async () => {
      console.info("[fileDownload] load", {
        xhr: getDownloadXhrDiagnostics(
          xhr,
          latestProgress,
          knownSize,
          typeof navigator !== "undefined" ? navigator.onLine : undefined,
        ),
      });
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
            console.info("[fileDownload] saving", {
              fileName: downloadFileName,
              fileSize: xhr.response?.size ?? 0,
              hasTargetPath: Boolean(filePath),
            });
            const savedPath = await electronAPI.saveDownloadedFile({
              data: await xhr.response.arrayBuffer(),
              fileName: downloadFileName,
              filePath,
            });
            if (!savedPath) {
              failDownload(new Error("Target file path is invalid"));
              return;
            }
            console.info("[fileDownload] saved", {
              fileName: downloadFileName,
              fileSize: xhr.response?.size ?? 0,
              hasTargetPath: Boolean(filePath),
            });
            updateProgress(100, "success");
            resolve(savedPath);
            return;
          } else {
            console.info("[fileDownload] saving-browser-blob", {
              fileName: downloadFileName,
              fileSize: xhr.response?.size ?? 0,
            });
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
      console.error("[fileDownload] http-error", {
        status: xhr.status,
        statusText: xhr.statusText,
        responseUrl: xhr.responseURL ? getDownloadUrlLogDetails(xhr.responseURL) : "",
        responseSize: xhr.response?.size ?? 0,
      });
      failDownload(responseError || new Error(`HTTP ${xhr.status}`));
    };

    xhr.onerror = (event) => {
      console.error("[fileDownload] network-error", {
        eventType: event.type,
        ...getDownloadXhrDiagnostics(
          xhr,
          latestProgress,
          knownSize,
          typeof navigator !== "undefined" ? navigator.onLine : undefined,
        ),
        request: getDownloadUrlLogDetails(resolvedUrl),
      });
      failDownload(new Error("Network error"));
    };
    xhr.ontimeout = (event) => {
      console.error("[fileDownload] timeout", {
        eventType: event.type,
        ...getDownloadXhrDiagnostics(
          xhr,
          latestProgress,
          knownSize,
          typeof navigator !== "undefined" ? navigator.onLine : undefined,
        ),
        request: getDownloadUrlLogDetails(resolvedUrl),
      });
      failDownload(new Error("Download timed out"));
    };
    xhr.onabort = (event) => {
      console.error("[fileDownload] abort", {
        eventType: event.type,
        ...getDownloadXhrDiagnostics(
          xhr,
          latestProgress,
          knownSize,
          typeof navigator !== "undefined" ? navigator.onLine : undefined,
        ),
        request: getDownloadUrlLogDetails(resolvedUrl),
      });
      failDownload(new Error("Download aborted"));
    };
    xhr.send();
  });
};
