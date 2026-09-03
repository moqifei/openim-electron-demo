import { expect, test } from "@playwright/test";
import fs from "node:fs";

import { getPngDimensions } from "../electron/utils/pngDimensions";
import { uint8ArrayToDataUrl } from "../electron/utils/screenshotData";
import { formatScreenshotShortcut } from "../src/utils/screenshotShortcut";

test("formats a configured screenshot shortcut for display", () => {
  expect(formatScreenshotShortcut("CommandOrControl+Alt+S")).toBe(
    "Ctrl + Alt + S",
  );
});

test("encodes screenshot bytes as a valid base64 data URL", () => {
  const dataUrl = uint8ArrayToDataUrl(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );

  expect(dataUrl).toBe("data:image/png;base64,iVBORw==");
});

test("reads width and height from a PNG IHDR header", () => {
  const pngHeader = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x07, 0x80, 0x00, 0x00, 0x04, 0x38,
  ]);

  expect(getPngDimensions(pngHeader)).toEqual({ width: 1920, height: 1080 });
});

test("rejects data that is not long enough to contain PNG dimensions", () => {
  expect(() => getPngDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(
    "Invalid PNG data",
  );
});

test("registers the global screenshot shortcut without removing it on blur", () => {
  const shortcutSource = fs.readFileSync("electron/main/shortcutManage.ts", "utf8");
  const windowSource = fs.readFileSync("electron/main/windowManage.ts", "utf8");

  expect(shortcutSource).toContain("CommandOrControl+Shift+X");
  expect(windowSource).not.toContain('mainWindow.on("blur", () => {\n    unregisterShortcuts();');
});

test("exposes the screenshot clipboard IPC", () => {
  const constantsSource = fs.readFileSync("electron/constants/index.ts", "utf8");
  const preloadSource = fs.readFileSync("electron/preload/index.ts", "utf8");
  const ipcSource = fs.readFileSync("electron/main/ipcHandlerManage.ts", "utf8");
  const typeSource = fs.readFileSync("src/types/globalExpose.d.ts", "utf8");

  expect(constantsSource).toContain("writeClipboardImage");
  expect(preloadSource).toContain("writeClipboardImage");
  expect(typeSource).toContain("writeClipboardImage");
  expect(ipcSource).toContain("clipboard.writeImage");
  expect(ipcSource).toContain("nativeImage.createFromDataURL");
});

test("wires the global screenshot event and final image to ChatFooter", () => {
  const chatFooterSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/index.tsx",
    "utf8",
  );

  expect(chatFooterSource).toContain("triggerScreenshot");
  expect(chatFooterSource).toContain("writeClipboardImage");
  expect(chatFooterSource).toContain("croppedBase64");
});

test("does not read the removed screenshot hide-window setting", () => {
  const footerSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/index.tsx",
    "utf8",
  );
  expect(footerSource).not.toContain("screenshotHideWindow");
});

test("shows the global shortcut in the screenshot button hover text", () => {
  const actionBarSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
    "utf8",
  );

  expect(actionBarSource).toMatch(
    /const screenshotShortcut = useUserStore\(\s*\(state\) => state\.appSettings\.screenshotShortcut,?\s*\);/,
  );
  expect(actionBarSource).toMatch(
    /formatScreenshotShortcut\(\s*screenshotShortcut,?\s*\)/,
  );
  expect(actionBarSource).not.toContain('title="截图（Ctrl+Shift+X）"');
});
