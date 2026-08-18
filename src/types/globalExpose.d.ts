import { Platform } from "@openim/wasm-client-sdk";

export type DataPath = "public" | "emojiData" | "sdkResources" | "logsPath";

export type OpenFileDialogOptions = {
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  properties?: Array<
    "openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles"
  >;
};

export interface IElectronAPI {
  getDataPath: (key: DataPath) => string;
  getVersion: () => string;
  getPlatform: () => Platform;
  getSystemVersion: () => string;
  subscribe: (channel: string, callback: (...args: any[]) => void) => () => void;
  subscribeOnce: (channel: string, callback: (...args: any[]) => void) => void;
  unsubscribeAll: (channel: string) => void;
  ipcInvoke: <T = unknown>(channel: string, ...arg: any) => Promise<T>;
  ipcSend: (channel: string, ...arg: any) => void;
  ipcSendSync: <T = unknown>(channel: string, ...arg: any) => T;
  saveFileToDisk: (params: { file: File; sync?: boolean }) => Promise<string>;
  getFileByPath: (filePath: string) => Promise<File | null>;
  openFileDialog: (options?: OpenFileDialogOptions) => Promise<string[]>;
  saveDownloadedFile: (params: {
    data: ArrayBuffer;
    fileName: string;
  }) => Promise<boolean>;
  startScreenshot: (
    hideWindow?: boolean,
  ) => Promise<{ dataUrl: string; isSelection: boolean } | null>;
  readClipboardImage: () => Promise<string | null>;
  writeClipboardImage: (base64: string) => Promise<void>;
  saveScreenshotFile: (base64: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
    userClick: (userID?: string, groupID?: string) => void;
    editRevoke: (clientMsgID: string) => void;
    screenshotPreview: (results: string) => void;
  }
}

declare module "i18next" {
  interface TFunction {
    (key: string, options?: object): string;
  }
}
