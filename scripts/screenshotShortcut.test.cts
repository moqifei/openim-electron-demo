import assert = require("assert");
import fs = require("fs");
import path = require("path");

const shortcutManage = fs.readFileSync(
  path.join(process.cwd(), "electron/main/shortcutManage.ts"),
  "utf8",
);
const constants = fs.readFileSync(
  path.join(process.cwd(), "electron/constants/index.ts"),
  "utf8",
);
const ipc = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
const settings = fs.readFileSync(
  path.join(process.cwd(), "src/layout/LeftNavBar/PersonalSettings.tsx"),
  "utf8",
);

assert.ok(shortcutManage.includes('DEFAULT_SCREENSHOT_SHORTCUT = "CommandOrControl+Shift+X"'));
assert.ok(shortcutManage.includes('getStore().get(SCREENSHOT_SHORTCUT_KEY)'));
assert.ok(shortcutManage.includes("globalShortcut.unregister(screenshotShortcut)"));
assert.ok(
  /if\s*\(!app\.isReady\(\)\)\s*return/.test(shortcutManage),
  "shortcut cleanup must wait until Electron is ready",
);
assert.ok(shortcutManage.includes("updateScreenshotShortcut"));
assert.ok(constants.includes('updateScreenshotShortcut: "updateScreenshotShortcut"'));
assert.ok(ipc.includes("IpcRenderToMain.updateScreenshotShortcut"));
assert.ok(settings.includes("screenshotShortcut"));
assert.ok(settings.includes("onKeyDown={captureScreenshotShortcut}"));

console.log("screenshotShortcut tests passed");
