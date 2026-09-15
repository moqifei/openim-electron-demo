import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const windowSource = read("electron/main/windowManage.ts");
const ipcSource = read("electron/main/ipcHandlerManage.ts");
const preloadSource = read("electron/preload/index.ts");
const typeSource = read("src/types/globalExpose.d.ts");
const footerSource = read("src/pages/chat/queryChat/ChatFooter/index.tsx");
const actionBarSource = read(
  "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
);

const triggerBody = windowSource
  .split("export const triggerScreenshot = () =>")[1]
  .split("// utils")[0];
assert.doesNotMatch(triggerBody, /\.show\(\)|\.restore\(\)|\.focus\(\)/);
assert.match(
  ipcSource,
  /IpcRenderToMain\.startScreenshot, async \(_, hideWindow: boolean = true\) =>/,
);
assert.match(
  ipcSource,
  /const win = BrowserWindow\.getFocusedWindow\(\);[\s\S]*?screen\.getDisplayNearestPoint\(screen\.getCursorScreenPoint\(\)\)[\s\S]*?screen\.getPrimaryDisplay\(\)/,
);
assert.doesNotMatch(ipcSource, /throw new Error\(["']No active window["']\)/);
assert.match(
  ipcSource,
  /const hiddenForCapture = Boolean\([\s\S]*?hideWindow[\s\S]*?win[\s\S]*?!win\.isDestroyed\(\)[\s\S]*?win\.isVisible\(\)/,
);
assert.match(ipcSource, /if \(hiddenForCapture\) \{[\s\S]*?win\.hide\(\)/);
assert.match(
  ipcSource,
  /if \(hiddenForCapture && win && !win\.isDestroyed\(\)\) \{[\s\S]*?win\.show\(\);[\s\S]*?win\.focus\(\);/,
);
assert.match(preloadSource, /const startScreenshot = \(hideWindow: boolean\): Promise/);
assert.match(typeSource, /startScreenshot: \(hideWindow: boolean\) =>/);
assert.match(
  footerSource,
  /const hideWindow = localStorage\.getItem\("screenshotHideWindow"\) !== "false";/,
);
assert.match(actionBarSource, /screenshotHideWindow/);
assert.match(footerSource, /startScreenshot\(hideWindow\)/);
assert.ok(footerSource.includes("writeClipboardImage"));
assert.ok(footerSource.includes("addPendingFiles"));

console.log("screenshotSilentBehavior tests passed");
