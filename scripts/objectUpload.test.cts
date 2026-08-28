import assert = require("assert");

const {
  buildObjectUploadName,
  shouldUseNativeObjectUpload,
} = require("../src/utils/objectUpload");

assert.equal(buildObjectUploadName("user-1", "file.log"), "user-1/file.log");
assert.equal(buildObjectUploadName("", "file.log"), "file.log");
assert.equal(shouldUseNativeObjectUpload("D:\\logs\\OpenIM.log", true), true);
assert.equal(shouldUseNativeObjectUpload("D:\\logs\\OpenIM.log", false), false);
assert.equal(shouldUseNativeObjectUpload("", true), false);

console.log("objectUpload tests passed");
