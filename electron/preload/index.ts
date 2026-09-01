import fs from "fs";
import * as iconv from "iconv-lite";
import path from "path";
import { DataPath, IElectronAPI } from "./../../src/types/globalExpose.d";
import { IpcRenderToMain } from "../constants";
import { contextBridge, ipcRenderer } from "electron";
import { isProd } from "../utils";
import "@openim/electron-client-sdk/lib/preload";
import { Platform } from "@openim/wasm-client-sdk";
import { getFileMimeType } from "./fileMimeType";

const getPlatform = () => {
  if (process.platform === "darwin") {
    return Platform.MacOSX;
  }
  if (process.platform === "win32") {
    return Platform.Windows;
  }
  return Platform.Linux;
};

const getDataPath = (key: DataPath) => {
  switch (key) {
    case "public":
      return isProd ? ipcRenderer.sendSync("getDataPath", "public") : "";
    case "sdkResources":
      return isProd ? ipcRenderer.sendSync("getDataPath", "sdkResources") : "";
    case "logsPath":
      return isProd ? ipcRenderer.sendSync("getDataPath", "logsPath") : "";
    default:
      return "";
  }
};

const subscribe = (channel: string, callback: (...args: any[]) => void) => {
  const subscription = (_, ...args) => callback(...args);
  ipcRenderer.on(channel, subscription);
  return () => ipcRenderer.removeListener(channel, subscription);
};

const subscribeOnce = (channel: string, callback: (...args: any[]) => void) => {
  ipcRenderer.once(channel, (_, ...args) => callback(...args));
};

const unsubscribeAll = (channel: string) => {
  ipcRenderer.removeAllListeners(channel);
};

const ipcInvoke = (channel: string, ...arg: any) => {
  return ipcRenderer.invoke(channel, ...arg);
};

const ipcSend = (channel: string, ...arg: any) => {
  ipcRenderer.send(channel, ...arg);
};

const ipcSendSync = (channel: string, ...arg: any) => {
  return ipcRenderer.sendSync(channel, ...arg);
};

const getUniqueSavePath = (originalPath: string) => {
  let counter = 0;
  let savePath = originalPath;
  let fileDir = path.dirname(originalPath);
  let fileName = path.basename(originalPath);
  let fileExt = path.extname(originalPath);
  let baseName = path.basename(fileName, fileExt);

  while (fs.existsSync(savePath)) {
    counter++;
    fileName = `${baseName}(${counter})${fileExt}`;
    savePath = path.join(fileDir, fileName);
  }

  return savePath;
};

const recoverMojibakePath = (filePath: string) => {
  if (process.platform !== "win32") return "";

  try {
    const recovered = Buffer.from(iconv.encode(filePath, "gb18030")).toString("utf8");
    if (recovered === filePath || recovered.includes("\uFFFD")) {
      return "";
    }
    return recovered;
  } catch (error) {
    console.warn("[preload] recover mojibake file path failed", error);
    return "";
  }
};

const readFileAsBrowserFile = async (filePath: string) => {
  const filename = path.basename(filePath);
  const data = await fs.promises.readFile(filePath);
  return new File([data], filename, { type: getFileMimeType(filename) });
};

const getFileByPath = async (filePath: string) => {
  try {
    return await readFileAsBrowserFile(filePath);
  } catch (error) {
    const recoveredPath = recoverMojibakePath(filePath);
    if (recoveredPath) {
      try {
        const file = await readFileAsBrowserFile(recoveredPath);
        console.warn("[preload] recovered mojibake file path", {
          filePath,
          recoveredPath,
        });
        return file;
      } catch (recoveredError) {
        console.warn("[preload] read recovered file path failed", {
          filePath,
          recoveredPath,
          error: recoveredError,
        });
      }
    }
    console.log(error);
    return null;
  }
};

const saveFileToDisk = async ({
  file,
  sync,
}: {
  file: File;
  sync?: boolean;
}): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const saveDir = ipcRenderer.sendSync("getDataPath", "sdkResources");
  const savePath = path.join(saveDir, file.name);
  const uniqueSavePath = getUniqueSavePath(savePath);
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }
  if (sync) {
    await fs.promises.writeFile(uniqueSavePath, Buffer.from(arrayBuffer));
  } else {
    fs.promises.writeFile(uniqueSavePath, Buffer.from(arrayBuffer));
  }
  return uniqueSavePath;
};

const startScreenshot = (
  hideWindow?: boolean,
): Promise<{ dataUrl: string; isSelection: boolean } | null> => {
  return ipcRenderer.invoke(IpcRenderToMain.startScreenshot, hideWindow);
};

const readClipboardImage = (): Promise<string | null> => {
  return ipcRenderer.invoke(IpcRenderToMain.readClipboardImage);
};

const writeClipboardImage = (base64: string): Promise<void> => {
  return ipcRenderer.invoke(IpcRenderToMain.writeClipboardImage, base64);
};

const writeClipboardImageFile = (data: ArrayBuffer): Promise<void> => {
  return ipcRenderer.invoke(IpcRenderToMain.writeClipboardImageFile, data);
};

const saveScreenshotFile = (base64: string): Promise<string> => {
  return ipcRenderer.invoke(IpcRenderToMain.saveScreenshotFile, base64);
};

const openFileDialog = (
  options?: Parameters<IElectronAPI["openFileDialog"]>[0],
): Promise<string[]> => {
  return ipcRenderer.invoke(IpcRenderToMain.openFileDialog, options);
};

const saveDownloadedFile = ({
  data,
  fileName,
  filePath,
}: Parameters<IElectronAPI["saveDownloadedFile"]>[0]): Promise<string | false> => {
  return ipcRenderer.invoke(IpcRenderToMain.saveDownloadedFile, {
    data,
    fileName,
    filePath,
  });
};

const openLocalPath = (filePath: string): Promise<string> => {
  return ipcRenderer.invoke(IpcRenderToMain.openLocalPath, filePath);
};

const Api: IElectronAPI = {
  getDataPath,
  getVersion: () => process.version,
  getPlatform,
  getSystemVersion: process.getSystemVersion,
  subscribe,
  subscribeOnce,
  unsubscribeAll,
  ipcInvoke,
  ipcSend,
  ipcSendSync,
  getFileByPath,
  openFileDialog,
  saveDownloadedFile,
  openLocalPath,
  saveFileToDisk,
  startScreenshot,
  readClipboardImage,
  writeClipboardImage,
  writeClipboardImageFile,
  saveScreenshotFile,
};

contextBridge.exposeInMainWorld("electronAPI", Api);
