const assert = require("assert");
const fs = require("fs");
const path = require("path");

const outputPath = path.join(process.cwd(), "dist-electron/main/nativeFileDownload.js");
const output = fs.readFileSync(outputPath, "utf8");

assert.doesNotMatch(
  output,
  /require\(["']\.\.\/utils\/nonDestructiveFileSave\.ts["']\)/,
  "the built main-process module must not require a TypeScript source file",
);
assert.doesNotThrow(() => require(outputPath));

console.log("nativeFileDownload build output tests passed");
