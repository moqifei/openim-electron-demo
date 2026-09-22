import assert = require("assert");
import fs = require("fs");
import path = require("path");

const {
  buildObjectUploadName,
  isObjectUploadFileSizeAllowed,
  MAX_OBJECT_UPLOAD_FILE_SIZE,
} = require("../src/utils/objectUpload");

assert.equal(buildObjectUploadName("user-1", "file.log"), "user-1/file.log");
assert.equal(buildObjectUploadName("", "file.log"), "file.log");
assert.equal(MAX_OBJECT_UPLOAD_FILE_SIZE, 200 * 1024 * 1024);
assert.equal(isObjectUploadFileSizeAllowed(MAX_OBJECT_UPLOAD_FILE_SIZE), true);
assert.equal(isObjectUploadFileSizeAllowed(MAX_OBJECT_UPLOAD_FILE_SIZE + 1), false);
const zhResources = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src/i18n/resources/zh.json"), "utf8"),
);
assert.equal(zhResources.toast.fileSizeExceedsLimit, "上传文件大小不得超过200M");
const objectUploadApi = fs.readFileSync(
  path.join(process.cwd(), "src/api/imApi.ts"),
  "utf8",
);
const ipcHandlers = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
assert.equal(objectUploadApi.includes("uploadObjectFileFromPath"), false);
assert.equal(ipcHandlers.includes("uploadObjectFileFromPath"), false);

console.log("objectUpload tests passed");
