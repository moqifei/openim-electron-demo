import { v4 as uuidV4 } from "uuid";

import { ObjectUploadProgressHandler, uploadObjectFile } from "@/api/imApi";
import { IMSDK } from "@/layout/MainContentWrap";
import { makeUniqueUploadFileName } from "@/utils/chatAttachment";
import { normalizeMojibakeString } from "@/utils/mojibake";

export interface FileWithPath extends File {
  path?: string;
}

const isInvalidSelectedFile = (file: FileWithPath) => !file.name || file.size === 0;

const normalizeFileMetadata = (file: FileWithPath) => {
  const normalizedName = normalizeMojibakeString(file.name);
  const normalizedPath = normalizeMojibakeString(file.path);
  const normalizedFile =
    normalizedName && normalizedName !== file.name
      ? new File([file], normalizedName, {
          type: file.type,
          lastModified: file.lastModified,
        })
      : file;

  if (normalizedPath) {
    Object.defineProperty(normalizedFile, "path", {
      configurable: true,
      value: normalizedPath,
    });
  }

  return normalizedFile as FileWithPath;
};

const getUsableFile = async (file: FileWithPath) => {
  file = normalizeFileMetadata(file);

  if (!isInvalidSelectedFile(file)) {
    return file;
  }

  if (!file.path || !window.electronAPI?.getFileByPath) {
    throw new Error(
      `Selected file is unreadable: name=${file.name || "<empty>"}, size=${file.size}`,
    );
  }

  const fileFromPath = (await window.electronAPI.getFileByPath(
    file.path,
  )) as FileWithPath | null;
  if (!fileFromPath || !fileFromPath.name) {
    throw new Error(`Failed to read selected file from path: ${file.path}`);
  }

  const normalizedFile = normalizeFileMetadata(
    fileFromPath.type
      ? fileFromPath
      : new File([fileFromPath], fileFromPath.name, {
          type: file.type || "application/octet-stream",
        }),
  );

  Object.defineProperty(normalizedFile, "path", {
    configurable: true,
    value: normalizeMojibakeString(file.path),
  });

  return normalizedFile;
};

export type FileMessageOptions = {
  onProgress?: ObjectUploadProgressHandler;
};

export function useFileMessage() {
  const getImageMessage = async (
    file: FileWithPath,
    messageConfig?: FileMessageOptions,
  ) => {
    file = await getUsableFile(file);
    const uploadName = makeUniqueUploadFileName(file.name, uuidV4());
    const { width, height } = await getPicInfo(file);
    const { data: uploaded } = await uploadObjectFile(file, {
      name: uploadName,
      contentType: file.type || "image/png",
      cause: "chat-image",
      onProgress: messageConfig?.onProgress,
    });
    const baseInfo = {
      uuid: uuidV4(),
      type: file.type || "image/png",
      size: file.size,
      width: width || 0,
      height: height || 0,
      url: uploaded.url,
    };

    const messageOptions = {
      sourcePicture: baseInfo,
      bigPicture: baseInfo,
      snapshotPicture: baseInfo,
      sourcePath: "",
    };

    return (await IMSDK.createImageMessageByURL(messageOptions)).data;
  };

  const getPicInfo = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const _URL = window.URL || window.webkitURL;
      const img = new Image();
      const objectURL = _URL.createObjectURL(file);
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Failed to load image metadata: ${file.name}`));
      }, 10000);
      const cleanup = () => {
        window.clearTimeout(timer);
        _URL.revokeObjectURL(objectURL);
      };

      img.onload = function () {
        cleanup();
        resolve(img);
      };
      img.onerror = function () {
        cleanup();
        reject(new Error(`Failed to load image metadata: ${file.name}`));
      };
      img.src = objectURL;
    });

  const getFileMessage = async (
    file: FileWithPath,
    messageConfig?: FileMessageOptions,
  ) => {
    file = await getUsableFile(file);
    const uploadName = makeUniqueUploadFileName(file.name, uuidV4());
    const { data: uploaded } = await uploadObjectFile(file, {
      name: uploadName,
      contentType: file.type || "application/octet-stream",
      cause: "chat-file",
      onProgress: messageConfig?.onProgress,
    });
    const messageOptions = {
      filePath: "",
      fileName: file.name,
      uuid: uuidV4(),
      sourceUrl: uploaded.url,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
    };
    return (await IMSDK.createFileMessageByURL(messageOptions)).data;
  };

  const getCardMessage = async (user: {
    userID: string;
    nickname: string;
    faceURL: string;
  }) => {
    return (
      await IMSDK.createCardMessage({
        userID: user.userID,
        nickname: user.nickname || "",
        faceURL: user.faceURL || "",
        ex: "",
      })
    ).data;
  };

  return {
    getImageMessage,
    getFileMessage,
    getCardMessage,
  };
}
