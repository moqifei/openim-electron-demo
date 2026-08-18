import { test, expect } from "@playwright/test";
import fs from "node:fs";

import {
  getDownloadFileExtension,
  getDownloadFileFilters,
  inferDownloadFileName,
} from "../src/utils/downloadFileName";

test("prefers a real message filename over response metadata", () => {
  expect(
    inferDownloadFileName({
      fileName: "原始文档.docx",
      contentDisposition: 'attachment; filename="server.doc"',
      url: "https://example.test/download/other.txt",
      mimeType: "text/plain",
    }),
  ).toBe("原始文档.docx");
});

test("decodes RFC 5987 content disposition filename", () => {
  expect(
    inferDownloadFileName({
      contentDisposition: "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.docx",
    }),
  ).toBe("测试.docx");
});

test("uses URL and MIME type before falling back to download", () => {
  expect(
    inferDownloadFileName({
      fileName: "download",
      url: "https://example.test/files/report",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  ).toBe("report.docx");
  expect(inferDownloadFileName({ fileName: "download" })).toBe("download");
});

test("returns the extension without a leading dot", () => {
  expect(getDownloadFileExtension("report.DOCX")).toBe("docx");
  expect(getDownloadFileExtension("download")).toBe("");
});

test("creates a default type filter and an editable all-files option", () => {
  expect(getDownloadFileFilters("report.docx")).toEqual([
    { name: "DOCX 文件 (*.docx)", extensions: ["docx"] },
    { name: "所有文件 (*.*)", extensions: ["*"] },
  ]);
});

test("exposes the native downloaded-file save IPC contract", () => {
  const constantsSource = fs.readFileSync("electron/constants/index.ts", "utf8");
  const preloadSource = fs.readFileSync("electron/preload/index.ts", "utf8");

  expect(constantsSource).toContain("saveDownloadedFile");
  expect(preloadSource).toContain("saveDownloadedFile");
});

test("keeps main-process download filters inside the Electron bundle", () => {
  const ipcSource = fs.readFileSync("electron/main/ipcHandlerManage.ts", "utf8");

  expect(ipcSource).not.toContain('../../src/utils/downloadFileName');
  expect(ipcSource).toContain("../utils/downloadFileFilters");
});

test("routes Electron downloads through the native save path", () => {
  const fileDownloadSource = fs.readFileSync("src/utils/fileDownload.ts", "utf8");

  expect(fileDownloadSource).toContain("Content-Disposition");
  expect(fileDownloadSource).toContain("response.arrayBuffer()");
  expect(fileDownloadSource).toContain("saveDownloadedFile");
});

test("does not replace missing ordinary file names before inference", () => {
  const callSites = [
    "src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx",
    "src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx",
    "src/pages/chat/queryChat/MessageItem/QuoteMessageRender.tsx",
    "src/pages/chat/queryChat/MultiSelectToolbar.tsx",
  ];

  for (const callSite of callSites) {
    expect(fs.readFileSync(callSite, "utf8")).not.toContain('|| "download"');
  }
});

test("uses the unified download helper for image downloads", () => {
  const mediaMessageSource = fs.readFileSync(
    "src/pages/chat/queryChat/MessageItem/MediaMessageRender.tsx",
    "utf8",
  );

  expect(mediaMessageSource).toContain("downloadFileWithProgress");
});
