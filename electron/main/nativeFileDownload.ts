import fs from "fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

type NativeDownloadLogger = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type NativeFileDownloadOptions = {
  url: string;
  targetPath: string;
  token?: string | null;
  requestId: string;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
  logger: NativeDownloadLogger;
};

type NativeDownloadError = Error & {
  code?: string;
  statusCode?: number;
  downloaded?: number;
  total?: number;
};

const getUrlLogDetails = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
      pathname: parsed.pathname,
    };
  } catch {
    return { protocol: "", host: "", port: "", pathname: "<invalid-url>" };
  }
};

const getErrorDetails = (error: unknown) => {
  const nativeError = error as NativeDownloadError;
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    ...(typeof nativeError.code === "string" ? { code: nativeError.code } : {}),
    ...(typeof nativeError.statusCode === "number"
      ? { statusCode: nativeError.statusCode }
      : {}),
    ...(typeof nativeError.downloaded === "number"
      ? { downloaded: nativeError.downloaded }
      : {}),
    ...(typeof nativeError.total === "number" ? { total: nativeError.total } : {}),
  };
};

const createDownloadError = (
  message: string,
  details: Partial<NativeDownloadError> = {},
) => Object.assign(new Error(message), details) as NativeDownloadError;

const createDownloadCancelledError = () =>
  createDownloadError("Native download cancelled", {
    code: "ERR_DOWNLOAD_CANCELLED",
  });

const getResponseTotal = (response: IncomingMessage) => {
  const contentLength = response.headers["content-length"];
  const total = Number(contentLength);
  return Number.isFinite(total) && total >= 0 ? total : 0;
};

const getRequestClient = (url: string) => {
  const parsed = new URL(url);
  if (parsed.protocol === "https:") return https;
  if (parsed.protocol === "http:") return http;
  throw createDownloadError(`Unsupported download protocol: ${parsed.protocol}`, {
    code: "ERR_UNSUPPORTED_PROTOCOL",
  });
};

const requestResponse = (
  url: string,
  initialUrl: string,
  token: string | null | undefined,
  redirectCount: number,
  logger: NativeDownloadLogger,
  signal?: AbortSignal,
): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    let request: ReturnType<typeof http.get>;
    let settled = false;

    const cleanupAbortListener = () => signal?.removeEventListener("abort", onAbort);
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      reject(error);
    };
    const resolveOnce = (response: IncomingMessage) => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      resolve(response);
    };
    const onAbort = () => {
      const error = createDownloadCancelledError();
      request?.destroy(error);
      rejectOnce(error);
    };

    if (signal?.aborted) {
      rejectOnce(createDownloadCancelledError());
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const client = getRequestClient(url);
      const headers: Record<string, string> = { operationID: randomUUID() };
      if (token && new URL(url).origin === new URL(initialUrl).origin) {
        headers.token = token;
      }

      logger.info("[nativeFileDownload] request", {
        request: getUrlLogDetails(url),
        redirectCount,
        hasToken: Boolean(headers.token),
      });

      request = client.get(
        url,
        { headers, timeout: REQUEST_TIMEOUT_MS },
        (response) => {
          const statusCode = response.statusCode ?? 0;
          logger.info("[nativeFileDownload] response", {
            request: getUrlLogDetails(url),
            statusCode,
            contentLength: getResponseTotal(response),
          });

          if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
            response.resume();
            if (redirectCount >= MAX_REDIRECTS) {
              rejectOnce(
                createDownloadError("Too many redirects while downloading file", {
                  code: "ERR_TOO_MANY_REDIRECTS",
                  statusCode,
                }),
              );
              return;
            }
            const redirectedUrl = new URL(response.headers.location, url).toString();
            requestResponse(
              redirectedUrl,
              initialUrl,
              token,
              redirectCount + 1,
              logger,
              signal,
            )
              .then(resolveOnce)
              .catch(rejectOnce);
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            response.resume();
            response.once("end", () => {
              rejectOnce(
                createDownloadError(`HTTP ${statusCode}`, {
                  code: `HTTP_${statusCode}`,
                  statusCode,
                }),
              );
            });
            return;
          }

          resolveOnce(response);
        },
      );
    } catch (error) {
      rejectOnce(error);
      return;
    }

    request.once("timeout", () => {
      request.destroy(
        createDownloadError("Native download timed out", { code: "ETIMEDOUT" }),
      );
    });
    request.once("error", (error) => {
      rejectOnce(error);
    });
  });

const streamResponseToFile = (
  response: IncomingMessage,
  targetPath: string,
  requestId: string,
  onProgress: ((loaded: number, total: number) => void) | undefined,
  logger: NativeDownloadLogger,
  signal?: AbortSignal,
) =>
  new Promise<string>((resolve, reject) => {
    const total = getResponseTotal(response);
    const partialPath = `${targetPath}.${requestId}.part`;
    let downloaded = 0;
    let settled = false;
    const output = fs.createWriteStream(partialPath, { flags: "wx" });

    const cleanupPartialFile = () =>
      fs.promises.unlink(partialPath).catch(() => undefined);
    const cleanupAbortListener = () => signal?.removeEventListener("abort", onAbort);

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      const nativeError =
        error instanceof Error
          ? (error as NativeDownloadError)
          : createDownloadError(String(error));
      nativeError.downloaded = downloaded;
      nativeError.total = total;
      response.destroy();
      output.destroy();
      void cleanupPartialFile();
      logger.error("[nativeFileDownload] stream-error", {
        error: getErrorDetails(nativeError),
        downloaded,
        total,
      });
      reject(nativeError);
    };
    const onAbort = () => fail(createDownloadCancelledError());

    if (signal?.aborted) {
      fail(createDownloadCancelledError());
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    response.on("data", (chunk: Buffer) => {
      downloaded += chunk.length;
      onProgress?.(downloaded, total);
    });
    response.once("error", fail);
    output.once("error", fail);
    output.once("finish", async () => {
      if (settled) return;
      settled = true;
      cleanupAbortListener();
      try {
        if (fs.existsSync(targetPath))
          await fs.promises.rm(targetPath, { force: true });
        await fs.promises.rename(partialPath, targetPath);
        logger.info("[nativeFileDownload] saved", {
          targetPath,
          downloaded,
          total,
        });
        resolve(targetPath);
      } catch (error) {
        const nativeError =
          error instanceof Error
            ? (error as NativeDownloadError)
            : createDownloadError(String(error));
        nativeError.downloaded = downloaded;
        nativeError.total = total;
        output.destroy();
        void cleanupPartialFile();
        reject(nativeError);
      }
    });

    response.pipe(output);
  });

export const downloadFileNative = async ({
  url,
  targetPath,
  token,
  requestId,
  signal,
  onProgress,
  logger,
}: NativeFileDownloadOptions) => {
  if (!path.isAbsolute(targetPath)) {
    throw createDownloadError("Invalid native download target path", {
      code: "EINVAL",
    });
  }

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  if (signal?.aborted) throw createDownloadCancelledError();
  const response = await requestResponse(url, url, token, 0, logger, signal);
  return streamResponseToFile(
    response,
    targetPath,
    requestId || randomUUID(),
    onProgress,
    logger,
    signal,
  );
};

export { getErrorDetails as getNativeDownloadErrorDetails };
