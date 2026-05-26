import { MessageItem } from "@openim/wasm-client-sdk";
import { v4 as uuidV4 } from "uuid";

import { IMSDK } from "@/layout/MainContentWrap";
import { base64toFile, canSendImageTypeList } from "@/utils/common";

export interface FileWithPath extends File {
  path?: string;
}

export function useFileMessage() {
  const getImageMessage = async (file: FileWithPath) => {
    const { width, height } = await getPicInfo(file);
    const baseInfo = {
      uuid: uuidV4(),
      type: file.type,
      size: file.size,
      width,
      height,
      url: URL.createObjectURL(file),
    };

    if (window.electronAPI) {
      const imageMessage = (await IMSDK.createImageMessageFromFullPath(file.path!))
        .data;
      imageMessage.pictureElem!.sourcePicture.url = baseInfo.url;
      return imageMessage;
    }
    const options = {
      sourcePicture: baseInfo,
      bigPicture: baseInfo,
      snapshotPicture: baseInfo,
      sourcePath: "",
      file,
    };

    return (await IMSDK.createImageMessageByFile(options)).data;
  };

  const getPicInfo = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const _URL = window.URL || window.webkitURL;
      const img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.src = _URL.createObjectURL(file);
    });


  const getFileMessage = async (file: FileWithPath) => {
    if (window.electronAPI) {
      return (await IMSDK.createFileMessageFromFullPath({
        filePath: file.path!,
        fileName: file.name,
      } as any)).data;
    }
    const options = {
      filePath: file.name,
      fileName: file.name,
      uuid: uuidV4(),
      sourceUrl: "",
      fileSize: file.size,
      file,
    };
    return (await IMSDK.createFileMessageByFile(options)).data;
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
