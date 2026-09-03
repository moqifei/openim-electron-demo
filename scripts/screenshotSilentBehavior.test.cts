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
assert.match(ipcSource, /IpcRenderToMain\.startScreenshot, async \(\)/);
assert.doesNotMatch(ipcSource, /hideWindow/);
assert.match(preloadSource, /const startScreenshot = \(\): Promise/);
assert.match(typeSource, /startScreenshot: \(\) =>/);
assert.doesNotMatch(footerSource, /screenshotHideWindow/);
assert.doesNotMatch(actionBarSource, /screenshotHideWindow|截图时隐藏窗口/);
assert.match(footerSource, /startScreenshot\(\)/);
assert.ok(footerSource.includes("writeClipboardImage"));
assert.ok(footerSource.includes("addPendingFiles"));

console.log("screenshotSilentBehavior tests passed");
