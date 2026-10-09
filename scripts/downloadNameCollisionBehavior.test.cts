import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const ipcHandler = read("electron/main/ipcHandlerManage.ts");
const nativeDownload = read("electron/main/nativeFileDownload.ts");

assert.match(
  ipcHandler,
  /writeFileWithoutOverwrite\(targetPath, Buffer\.from\(data\)\)/,
  "ordinary downloads should create a new numbered path instead of overwriting",
);
assert.match(
  nativeDownload,
  /copyFileWithoutOverwrite\(partialPath, targetPath\)/,
  "native downloads should finalize to a new numbered path instead of overwriting",
);
assert.doesNotMatch(
  nativeDownload,
  /fs\.promises\.rm\(targetPath/,
  "native downloads must not delete an existing target before finalizing",
);

console.log("downloadNameCollisionBehavior tests passed");
