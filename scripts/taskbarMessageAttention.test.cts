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
const globalEvents = fs.readFileSync(
  path.join(process.cwd(), "src/layout/useGlobalEvents.tsx"),
  "utf8",
);

assert.ok(constants.includes('requestMainWindowAttention: "requestMainWindowAttention"'));
assert.ok(
  ipc.includes("IpcRenderToMain.requestMainWindowAttention") &&
    ipc.includes("taskFlicker()"),
  "new message attention IPC should invoke taskbar flicker",
);
assert.ok(
  globalEvents.includes('ipcSend("requestMainWindowAttention")'),
  "incoming messages should request taskbar attention",
);
assert.ok(windowManage.includes("if (!mainWindow || mainWindow.isDestroyed()) return;"));
assert.ok(
  windowManage.includes(
    "if (!isWin || (!mainWindow.isVisible() && !mainWindow.isMinimized())) return;",
  ),
);
assert.ok(windowManage.includes("mainWindow.isMinimized()"));
assert.ok(windowManage.includes("mainWindow.isFocused()"));
assert.ok(windowManage.includes("mainWindow.flashFrame(true)"));
assert.ok(windowManage.includes("mainWindow?.flashFrame(false)"));

console.log("taskbarMessageAttention tests passed");
