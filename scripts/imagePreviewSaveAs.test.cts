import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const contentSource = read("src/pages/chat/queryChat/ChatContent.tsx");
const fileNameSource = read("src/utils/downloadFileName.ts");
const ipcSource = read("electron/main/ipcHandlerManage.ts");

assert.ok(contentSource.includes("DownloadOutlined"));
assert.ok(contentSource.includes("SaveOutlined"));
assert.ok(contentSource.includes('t("placeholder.saveAs")'));
assert.ok(contentSource.includes("ipcInvoke<"));
assert.ok(contentSource.includes('"chooseDownloadPath"'));
assert.ok(contentSource.includes("inferDownloadFileName({"));
assert.ok(contentSource.includes("filePath: selectedPath"));
assert.ok(contentSource.includes("showProgressToast: true"));
assert.ok(ipcSource.includes("IpcRenderToMain.chooseDownloadPath"));
assert.ok(fileNameSource.includes('"image/gif": "gif"'));
assert.ok(fileNameSource.includes('"image/bmp": "bmp"'));
assert.ok(fileNameSource.includes('"image/webp": "webp"'));

console.log("imagePreviewSaveAs tests passed");
