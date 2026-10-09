import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage.ts",
  ),
  "utf8",
);
const preload = fs.readFileSync(
  path.join(process.cwd(), "electron/preload/index.ts"),
  "utf8",
);
const ipcHandler = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);

assert.equal(
  /const shouldReloadFromPath = Boolean\(\s*file\.path && window\.electronAPI\?\.getFileByPath,?\s*\);/.test(
    source,
  ),
  true,
);
assert.equal(
  /if \(!shouldReloadFromPath && !isInvalidSelectedFile\(file\)\)/.test(source),
  true,
);
assert.equal(preload.includes('ipcRenderer.send("fileReadDiagnostics",'), true);
assert.equal(ipcHandler.includes('ipcMain.on("fileReadDiagnostics",'), true);

console.log("file upload path tests passed");
