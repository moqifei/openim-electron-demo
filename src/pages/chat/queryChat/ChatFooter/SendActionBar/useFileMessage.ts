import { v4 as uuidV4 } from "uuid";

import { IMSDK } from "@/layout/MainContentWrap";

export interface FileWithPath extends File {
  path?: string;
}

export function useFileMessage() {
  const getImageMessage = async (file: FileWithPath) => {
    const { width, height } = await getPicInfo(file);
    const blobUrl = URL.createObjectURL(file);
    const baseInfo = {
      uuid: uuidV4(),
      type: file.type || "image/png",
      size: file.size,
      width: width || 0,
      height: height || 0,
      url: blobUrl,
    };

    // In Electron, always use disk-path-based API to avoid structured
    // clone issues when the SDK's worker RPC (postMessage) tries to
    // transfer clipboard-backed File objects to the WASM worker.
    if (window.electronAPI) {
      const filePath =
        file.path ||
        (await window.electronAPI.saveFileToDisk({ file, sync: true }));
      const imageMessage = (
        await IMSDK.createImageMessageFromFullPath(filePath)
      ).data;
      imageMessage.pictureElem!.sourcePicture.url = baseInfo.url;
      URL.revokeObjectURL(blobUrl);
      return imageMessage;
    }

    // Web path: no file-system access, must pass File through the SDK
    // Rebuild from bytes first to maximise cloneability.
    const raw = await file.arrayBuffer();
    const buffer = raw.slice(0);
    const clonedFile = new File(
      [buffer],
      file.name || `image-${Date.now()}.png`,
      {
        type: file.type || "image/png",
        lastModified: Date.now(),
      },
    );

    const picUuid = uuidV4();
    const picUrl = URL.createObjectURL(clonedFile);
    const makePicInfo = () => ({
      uuid: picUuid,
      type: file.type || "image/png",
      size: file.size,
      width: width || 0,
      height: height || 0,
      url: picUrl,
    });

    const options = {
      sourcePicture: makePicInfo(),
      bigPicture: makePicInfo(),
      snapshotPicture: makePicInfo(),
      sourcePath: "",
      file: clonedFile,
    };

    URL.revokeObjectURL(blobUrl);

    return (await IMSDK.createImageMessageByFile(options)).data;
  };

  const getPicInfo = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
      const _URL = window.URL || window.webkitURL;
      const img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.src = _URL.createObjectURL(file);
    });

  const getFileMessage = async (file: FileWithPath) => {
    if (window.electronAPI) {
      const filePath =
        file.path ||
        (await window.electronAPI.saveFileToDisk({ file, sync: true }));
      return (
        await IMSDK.createFileMessageFromFullPath({
          filePath,
          fileName: file.name,
        } as any)
      ).data;
    }

    // Web path
    const raw = await file.arrayBuffer();
    const buffer = raw.slice(0);
    const clonedFile = new File([buffer], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });

    const options = {
      filePath: file.name,
      fileName: file.name,
      uuid: uuidV4(),
      sourceUrl: "",
      fileSize: file.size,
      file: clonedFile,
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
