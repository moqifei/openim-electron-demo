import assert = require("assert");
import fs = require("fs");
import path = require("path");

const { getFileMimeType, resolveFileContentType } = require("../src/utils/fileMimeType");
const preloadSource = fs.readFileSync(
  path.join(process.cwd(), "electron/preload/index.ts"),
  "utf8",
);

assert.equal(
  getFileMimeType("中信百信银行股份有限公司研发自测规范（2.0版，2026年）.docx"),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
);
assert.equal(getFileMimeType("unknown-extension.bin"), "application/octet-stream");
assert.equal(
  resolveFileContentType("document.docx", "application/octet-stream"),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
);
assert.equal(resolveFileContentType("document.docx", "text/plain"), "text/plain");
assert.ok(
  !preloadSource.includes("../../src/utils/fileMimeType"),
  "preload must not depend on a renderer source module that remains external in dev builds",
);

console.log("fileMimeType tests passed");
