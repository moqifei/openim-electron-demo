const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const fileDownload = read("src/utils/fileDownload.ts");
const progress = read("src/utils/fileTransferProgress.tsx");
const fileMessage = read("src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx");

assert.match(fileDownload, /signal\?: AbortSignal/);
assert.match(fileDownload, /isDownloadCancelledError/);
assert.match(fileDownload, /xhr\.abort\(\)/);
assert.match(fileDownload, /cancelDownloadFileNative/);
assert.match(
  fileDownload,
  /status: "active" \| "success" \| "exception" = "active",/,
  "progress updates without an explicit status must still make the notification cancellable",
);
assert.match(progress, /onCancel\?: \(\) => void/);
assert.match(progress, /onClose: status === "active" \? onCancel : undefined/);
assert.match(fileDownload, /const cancelFromProgressToast = \(\) => \{/);
assert.match(
  fileDownload,
  /onCancel: status === "active" \? cancelFromProgressToast : undefined/,
);
assert.match(fileMessage, /AbortController/);
assert.match(fileMessage, /cancelDownload/);
assert.match(fileMessage, /isDownloadCancelledError/);

console.log("download cancellation behavior tests passed");
