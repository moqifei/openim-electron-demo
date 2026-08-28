import assert = require("assert");
import fs = require("fs");
import path = require("path");

const messageItem = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/MessageItem/index.tsx"),
  "utf8",
);
const imageClipboard = fs.readFileSync(
  path.join(process.cwd(), "src/utils/imageClipboard.ts"),
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

assert.ok(
  messageItem.includes("MessageType.PictureMessage") &&
    messageItem.includes("copyImageToClipboard"),
  "image messages should use the image clipboard path from the action toolbar",
);
assert.ok(
  imageClipboard.includes("writeClipboardImageFile") &&
    imageClipboard.includes("ClipboardItem"),
  "image clipboard support should handle Electron and browser clipboard APIs",
);
assert.ok(
  messageItem.includes("MessageType.FileMessage") &&
    messageItem.includes("copyLocalFileToClipboard") &&
    messageItem.includes("downloadFileWithProgress") &&
    messageItem.includes("showProgressToast: false"),
  "file messages should download and copy the file itself from the action toolbar",
);
assert.ok(
  ipcConstants.includes('copyLocalFileToClipboard: "copyLocalFileToClipboard"') &&
    ipcHandler.includes("copyLocalFileToClipboard"),
  "the main process should expose a native file clipboard operation",
);

console.log("imageMessageCopy tests passed");
