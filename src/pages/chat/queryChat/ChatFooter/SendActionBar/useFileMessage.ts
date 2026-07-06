import { v4 as uuidV4 } from "uuid";

import { uploadObjectFile } from "@/api/imApi";
import { IMSDK } from "@/layout/MainContentWrap";

export interface FileWithPath extends File {
  path?: string;
}

const isInvalidSelectedFile = (file: FileWithPath) =>
  !file.name || file.size === 0;

const getUsableFile = async (file: FileWithPath) => {
  if (!isInvalidSelectedFile(file)) {
    return file;
  }

  if (!file.path || !window.electronAPI?.getFileByPath) {
    throw new Error(
      `Selected file is unreadable: name=${file.name || "<empty>"}, size=${file.size}`,
    );
  }

  const fileFromPath = (await window.electronAPI.getFileByPath(file.path)) as FileWithPath | null;
  if (!fileFromPath || !fileFromPath.name || fileFromPath.size === 0) {
    throw new Error(`Failed to read selected file from path: ${file.path}`);
  }

  const normalizedFile = fileFromPath.type
    ? fileFromPath
    : new File([fileFromPath], fileFromPath.name, {
        type: file.type || "application/octet-stream",
      });

  Object.defineProperty(normalizedFile, "path", {
    configurable: true,
    value: file.path,
  });

  return normalizedFile as FileWithPath;
};

export function useFileMessage() {
  const getImageMessage = async (file: FileWithPath) => {
    file = await getUsableFile(file);
    const { width, height } = await getPicInfo(file);
    const { data: uploaded } = await uploadObjectFile(file, {
      contentType: file.type || "image/png",
      cause: "chat-image",
    });
    const baseInfo = {
      uuid: uuidV4(),
      type: file.type || "image/png",
      size: file.size,
      width: width || 0,
      height: height || 0,
      url: uploaded.url,
    };

    const options = {
      sourcePicture: baseInfo,
      bigPicture: baseInfo,
      snapshotPicture: baseInfo,
      sourcePath: "",
    };

    return (await IMSDK.createImageMessageByURL(options)).data;
  };

  const getPicInfo = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const _URL = window.URL || window.webkitURL;
      const img = new Image();
      const objectURL = _URL.createObjectURL(file);
      let timer: number | undefined;
      const cleanup = () => {
        if (timer !== undefined) window.clearTimeout(timer);
        _URL.revokeObjectURL(objectURL);
      };
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Failed to load image metadata: ${file.name}`));
      }, 10000);

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

  const getFileMessage = async (file: FileWithPath) => {
    file = await getUsableFile(file);
    const { data: uploaded } = await uploadObjectFile(file, {
      contentType: file.type || "application/octet-stream",
      cause: "chat-file",
    });
    const options = {
      filePath: "",
      fileName: file.name,
      uuid: uuidV4(),
      sourceUrl: uploaded.url,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
    };
    return (await IMSDK.createFileMessageByURL(options)).data;
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
