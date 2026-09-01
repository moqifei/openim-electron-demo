import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) => fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const constants = read("electron/constants/index.ts");
const leftNav = read("src/layout/LeftNavBar/index.tsx");
const ipc = read("electron/main/ipcHandlerManage.ts");
const updateManage = read("electron/main/updateManage.ts");
const debUpdateManage = read("electron/main/debUpdateManage.ts");

assert.ok(
  constants.includes('checkForUpdates: "checkForUpdates"'),
  "manual update should have a dedicated IPC channel",
);
assert.ok(
  leftNav.includes('t("placeholder.checkNewVersion")') &&
    leftNav.includes('window.electronAPI?.ipcInvoke("checkForUpdates")'),
  "avatar menu should expose and trigger manual update checking",
);
assert.ok(
  ipc.includes("checkForWindowsUpdates") &&
    ipc.includes("checkForDebUpdates") &&
    ipc.includes("IpcRenderToMain.checkForUpdates"),
  "main process should route manual update checks to the platform updater",
);
assert.ok(
  updateManage.includes("export const checkForUpdates") &&
    updateManage.includes("autoUpdater.checkForUpdates()"),
  "electron-updater path should expose a manual check",
);
assert.ok(
  debUpdateManage.includes("export const checkForUpdates") &&
    debUpdateManage.includes("await runCheck()"),
  "deb updater path should expose a manual check",
);

console.log("manualUpdateEntry tests passed");
