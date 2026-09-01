import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/store";
import { resolveFileContentType } from "@/utils/fileMimeType";
import { normalizeMojibakeString } from "@/utils/mojibake";
import {
  buildObjectUploadName,
  shouldUseNativeObjectUpload,
} from "@/utils/objectUpload";
import { getApiAxios, getChatAxios } from "@/utils/request";
import { getChatToken, getIMToken } from "@/utils/storage";

const getRequest = () => getChatAxios();
const uploadRetryDelays = [800, 1600];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const stringifyLogMeta = (meta: unknown) => {
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
};

const isRetriableUploadError = (error: unknown) => {
  const axiosError = error as {
    message?: string;
    code?: string;
    response?: unknown;
    request?: unknown;
  };

  if (axiosError.response) return false;
  return Boolean(
    axiosError.request ||
      axiosError.message?.includes("Network Error") ||
      axiosError.message?.includes("timeout") ||
      axiosError.code === "ECONNABORTED",
  );
};

export const getRtcConnectData = async (room: string, identity: string) => {
  const token = (await getChatToken()) as string;
  return getRequest().post<{ serverUrl: string; token: string }>(
    "/user/rtc/get_token",
    {
      room,
      identity,
    },
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

export type ObjectUploadResp = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

export type ObjectUploadProgressHandler = (progress: number) => void;

export const EMPTY_FILE_UPLOAD_ERROR_MESSAGE = "不能上传空文件";

export const markMsgsAsRead = async (params: {
  conversationID: string;
  seqs: number[];
  userID: string;
}) => getApiAxios().post<void>("/msg/mark_msgs_as_read", params);

export type GroupMessageReadInfo = {
  seq: number;
  hasReadCount: number;
  unreadCount: number;
  groupMemberCount: number;
  hasReadUserIDList: string[];
};

export const getGroupMessagesReadInfo = async (params: {
  conversationID: string;
  groupID?: string;
  userID: string;
  seqs: number[];
}) =>
  getApiAxios().post<GroupMessageReadInfo[]>(
    "/msg/get_group_messages_read_info",
    params,
  );

export const uploadObjectFile = async (
  file: File,
  options?: {
    name?: string;
    contentType?: string;
    cause?: string;
    onProgress?: ObjectUploadProgressHandler;
  },
) => {
  const rawName = normalizeMojibakeString(options?.name ?? file.name);
  const filePath = normalizeMojibakeString((file as File & { path?: string }).path);
  if (!rawName || file.size === 0) {
    console.error("[uploadObjectFile] invalid file", {
      rawName,
      fileSize: file.size,
      fileType: options?.contentType ?? file.type,
      filePath,
      cause: options?.cause ?? "chat",
    });
    throw new Error(
      !rawName ? "Selected file is unreadable" : EMPTY_FILE_UPLOAD_ERROR_MESSAGE,
    );
  }

  const currentUserID = useUserStore.getState()?.selfInfo?.userID;
  // Backend requires non-admin users to prefix file name with their userID
  const uploadName = buildObjectUploadName(currentUserID, rawName);
  const fileContentType = resolveFileContentType(
    rawName,
    options?.contentType || file.type,
  );

  const request = getApiAxios();
  const uploadUrl = `${request.defaults.baseURL ?? ""}/object/upload`;
  const uploadMeta = {
    cause: options?.cause ?? "chat",
    uploadUrl,
    fileName: rawName,
    uploadName,
    fileSize: file.size,
    fileType: fileContentType,
    filePath,
  };

  const createFormData = () => {
    const formData = new FormData();
    formData.append("file", file, uploadName);
    formData.append("name", uploadName);
    formData.append("contentType", fileContentType);
    formData.append("cause", options?.cause ?? "chat");
    return formData;
  };

  console.info("[uploadObjectFile] start", stringifyLogMeta(uploadMeta));

  if (shouldUseNativeObjectUpload(filePath)) {
    options?.onProgress?.(0);
    const nativeResponse = await window.electronAPI!.ipcInvoke<{
      errCode?: number;
      errMsg?: string;
      data?: ObjectUploadResp;
    }>("uploadObjectFileFromPath", {
      filePath,
      uploadName,
      contentType: fileContentType,
      cause: options?.cause ?? "chat",
      baseURL: request.defaults.baseURL ?? "",
      token: await getIMToken(),
    });
    options?.onProgress?.(100);
    return nativeResponse;
  }

  for (let attempt = 0; attempt <= uploadRetryDelays.length; attempt += 1) {
    try {
      options?.onProgress?.(0);
      const response = await request.post<ObjectUploadResp>(
        "/object/upload",
        createFormData(),
        {
          timeout: 10 * 60 * 1000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total ?? file.size;
            if (!total) return;
            const progress = Math.round((progressEvent.loaded / total) * 100);
            options?.onProgress?.(Math.min(99, Math.max(0, progress)));
          },
        },
      );
      options?.onProgress?.(100);
      console.info(
        "[uploadObjectFile] success",
        stringifyLogMeta({
          ...uploadMeta,
          attempt: attempt + 1,
        }),
      );
      return response;
    } catch (error) {
      const axiosError = error as {
        message?: string;
        code?: string;
        response?: { status?: number; data?: unknown };
        request?: unknown;
        config?: {
          baseURL?: string;
          url?: string;
          method?: string;
          timeout?: number;
        };
      };
      const canRetry =
        attempt < uploadRetryDelays.length && isRetriableUploadError(error);
      const errorMeta = {
        ...uploadMeta,
        attempt: attempt + 1,
        willRetry: canRetry,
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        response: axiosError.response?.data,
        method: axiosError.config?.method,
        baseURL: axiosError.config?.baseURL,
        url: axiosError.config?.url,
        timeout: axiosError.config?.timeout,
        hasRequest: Boolean(axiosError.request),
      };

      if (!canRetry) {
        console.error("[uploadObjectFile] failed", stringifyLogMeta(errorMeta));
        throw error;
      }

      console.warn("[uploadObjectFile] retrying", stringifyLogMeta(errorMeta));
      await wait(uploadRetryDelays[attempt]);
    }
  }

  throw new Error("Upload failed");
};
