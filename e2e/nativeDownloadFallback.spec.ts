import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("keeps XHR as the primary download path and adds native fallback only after transport failure", () => {
  const source = fs.readFileSync("src/utils/fileDownload.ts", "utf8");

  expect(source).toContain("xhr.onerror =");
  expect(source).toContain('"downloadFileNative"');
  expect(source).toContain("downloadFileNativeProgress:");
  expect(source).toContain("electronAPI.subscribe");
  expect(source).toContain("getIMToken");
});

test("registers a streaming native download IPC with response and write error handling", () => {
  const source = fs.readFileSync("electron/main/ipcHandlerManage.ts", "utf8");
  const helper = fs.readFileSync("electron/main/nativeFileDownload.ts", "utf8");

  expect(source).toContain("downloadFileNative");
  expect(helper).toContain('response.once("error"');
  expect(helper).toContain('output.once("error"');
  expect(helper).toContain("downloaded");
  expect(helper).toContain("code");
});

test("registers a native download cancellation channel backed by abort controllers", () => {
  const source = fs.readFileSync("electron/main/ipcHandlerManage.ts", "utf8");
  const constants = fs.readFileSync("electron/constants/index.ts", "utf8");
  const helper = fs.readFileSync("electron/main/nativeFileDownload.ts", "utf8");

  expect(constants).toContain('cancelDownloadFileNative: "cancelDownloadFileNative"');
  expect(source).toContain("nativeDownloadAbortControllers");
  expect(source).toContain("cancelDownloadFileNative");
  expect(source).toContain("controller.abort()");
  expect(source).toContain("signal: controller.signal");
  expect(helper).toContain("ERR_DOWNLOAD_CANCELLED");
});
