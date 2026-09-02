import assert = require("assert");
import fs = require("fs");
import path = require("path");

const ipcHandler = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);

assert.ok(
  ipcHandler.includes('process.platform === "linux"') &&
    ipcHandler.includes('execFile("xdg-open"') &&
    ipcHandler.includes("[filePath]") &&
    ipcHandler.includes("shell.openPath(filePath)"),
  "Linux/UOS should use xdg-open for local files and keep shell.openPath as fallback",
);

console.log("openLocalPath UOS tests passed");
