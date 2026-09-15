const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const emojiPicker = read("src/pages/chat/queryChat/ChatFooter/SendActionBar/EmojiPicker.tsx");
const globalStyles = read("src/styles/global.scss");
const fileMessage = read("src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx");

assert.match(emojiPicker, /className="w-96 p-2"/);
assert.match(emojiPicker, /className="flex h-10 w-10[^"]*"/);
assert.match(emojiPicker, /className="text-2xl leading-none"/);
assert.match(globalStyles, /\.emojione \{\s*width: 20px !important;\s*height: 20px !important;/);

assert.match(
  fileMessage,
  /const downloadCacheKey = message\.clientMsgID \|\| message\.serverMsgID \|\| sourceUrl/,
);
assert.match(fileMessage, /downloadedFilePathCache\.get\(downloadCacheKey\)/);
assert.match(fileMessage, /downloadedFilePathCache\.set\(downloadCacheKey, savedPath\)/);
assert.match(fileMessage, /downloadedFilePathCache\.delete\(downloadCacheKey\)/);
assert.doesNotMatch(fileMessage, /downloadedFilePathCache\.(?:get|set|delete)\(sourceUrl/);

console.log("emoji size and file save-as isolation tests passed");
