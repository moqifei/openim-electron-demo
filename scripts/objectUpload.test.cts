import assert = require("assert");
import fs = require("fs");
import path = require("path");

const {
  buildObjectUploadName,
  isObjectUploadFileSizeAllowed,
  MAX_OBJECT_UPLOAD_FILE_SIZE,
  shouldFallbackFromNativeObjectUpload,
  shouldUseNativeObjectUpload,
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
assert.equal(shouldUseNativeObjectUpload("D:\\logs\\OpenIM.log", true), true);
assert.equal(shouldUseNativeObjectUpload("D:\\logs\\OpenIM.log", false), false);
assert.equal(shouldUseNativeObjectUpload("", true), false);
assert.equal(
  shouldFallbackFromNativeObjectUpload({
    errCode: -1,
    errMsg: "parse multipart form failed: unexpected EOF",
  }),
  true,
);
assert.equal(
  shouldFallbackFromNativeObjectUpload({
    errCode: -1,
    errMsg: "Request failed with status code 400",
  }),
  false,
);
assert.equal(
  shouldFallbackFromNativeObjectUpload({
    errCode: 1001,
    errMsg: "parse multipart form failed: unexpected EOF",
  }),
  false,
);

console.log("objectUpload tests passed");
