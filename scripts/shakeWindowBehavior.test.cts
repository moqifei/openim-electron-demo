import assert = require("assert");
import fs = require("fs");
import path = require("path");

const constants = fs.readFileSync(
  path.join(process.cwd(), "electron/constants/index.ts"),
  "utf8",
);
const ipc = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
const windowManage = fs.readFileSync(
  path.join(process.cwd(), "electron/main/windowManage.ts"),
  "utf8",
);

assert.ok(constants.includes('shakeMainWindow: "shakeMainWindow"'));
assert.ok(ipc.includes("payload?: { durationMs?: number }"));
assert.ok(ipc.includes("shakeMainWindow(payload?.durationMs)"));
assert.ok(windowManage.includes("const DEFAULT_SHAKE_DURATION_MS = 1000"));
assert.ok(windowManage.includes("showWindow();"));
assert.ok(windowManage.includes("mainWindow.focus();"));
assert.ok(windowManage.includes("mainWindow.getBounds()"));
assert.ok(windowManage.includes("mainWindow.setBounds(origin, false)"));
assert.ok(windowManage.includes("SHAKE_INTERVAL_MS"));
assert.ok(windowManage.includes("IpcMainToRender.shakeMainWindowEffect"));

const layout = fs.readFileSync(
  path.join(process.cwd(), "src/layout/MainContentLayout.tsx"),
  "utf8",
);
const styles = fs.readFileSync(
  path.join(process.cwd(), "src/styles/global.scss"),
  "utf8",
);
assert.ok(layout.includes('"shakeMainWindowEffect"'));
assert.ok(layout.includes("desktop-window-shake"));
assert.ok(styles.includes("@keyframes desktop-window-shake"));

console.log("shakeWindowBehavior tests passed");
