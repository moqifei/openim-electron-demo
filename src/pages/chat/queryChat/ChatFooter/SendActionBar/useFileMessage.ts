import { v4 as uuidV4 } from "uuid";

import { uploadObjectFile } from "@/api/imApi";
import { IMSDK } from "@/layout/MainContentWrap";

export interface FileWithPath extends File {
  path?: string;
}

export function useFileMessage() {
  const getImageMessage = async (file: FileWithPath) => {
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
    new Promise((resolve) => {
      const _URL = window.URL || window.webkitURL;
      const img = new Image();
      const objectURL = _URL.createObjectURL(file);
      img.onload = function () {
        _URL.revokeObjectURL(objectURL);
        resolve(img);
      };
      img.src = objectURL;
    });

  const getFileMessage = async (file: FileWithPath) => {
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
