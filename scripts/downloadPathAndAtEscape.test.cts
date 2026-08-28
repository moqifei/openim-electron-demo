import assert = require("assert");
import fs = require("fs");
import path = require("path");

const fileDownload = fs.readFileSync(
  path.join(process.cwd(), "src/utils/fileDownload.ts"),
  "utf8",
);
const settings = fs.readFileSync(
  path.join(process.cwd(), "src/layout/LeftNavBar/PersonalSettings.tsx"),
  "utf8",
);
const ipcConstants = fs.readFileSync(
  path.join(process.cwd(), "electron/constants/index.ts"),
  "utf8",
);
const ipcHandler = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
const fileMessageRender = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx",
  ),
  "utf8",
);
const atPopup = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx",
  ),
  "utf8",
);
const chatFooter = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatFooter/index.tsx"),
  "utf8",
);

assert.ok(
  fileDownload.includes("filePath") &&
    fileDownload.includes("filePath: filePath") &&
    !fileDownload.includes("chooseDownloadPath"),
  "downloads should pass an optional selected path without choosing one internally",
);
assert.ok(
  fileMessageRender.includes('"chooseDownloadPath"') &&
    fileMessageRender.indexOf('"chooseDownloadPath"') <
      fileMessageRender.indexOf("downloadFile(selectedPath)") &&
    fileMessageRender.includes('t("placeholder.save")') &&
    fileMessageRender.includes('t("placeholder.saveAs")') &&
    fileMessageRender.includes('t("placeholder.open")') &&
    fileMessageRender.includes('t("placeholder.openFolder")'),
  "save as should choose a path before starting the download",
);
assert.ok(
  settings.includes('key: "downloadPath"') &&
    settings.includes('properties: ["openDirectory"]'),
  "personal settings should configure the default download directory",
);
assert.ok(
  ipcConstants.includes('chooseDownloadPath: "chooseDownloadPath"') &&
    ipcConstants.includes('openLocalFolder: "openLocalFolder"') &&
    ipcHandler.includes("downloadPath") &&
    ipcHandler.includes("openLocalFolder") &&
    ipcHandler.includes('app.getPath("downloads")') &&
    ipcHandler.includes('store.set("downloadPath"'),
  "the main process should initialize and provide the configured download path",
);
assert.ok(
  atPopup.includes('onKeyDown={handleKeyDown}') &&
    atPopup.includes('case "Escape"') &&
    atPopup.includes("e.stopPropagation()"),
  "the @ member input should cancel on Escape",
);
assert.ok(
  chatFooter.includes("atPopupRequestIdRef") &&
    chatFooter.includes("handleAtClose"),
  "closing @ should invalidate pending member loading and reset the trigger",
);

console.log("downloadPathAndAtEscape tests passed");
