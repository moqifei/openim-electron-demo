import assert = require("assert");
import fs = require("fs");
import path = require("path");

const {
  getPreferredChatPasteUrl,
  getPreferredChatPasteText,
  shouldDeletePendingAttachmentOnBackspace,
} = require("../src/utils/chatInput");

assert.equal(
  getPreferredChatPasteUrl({
    plainText: "项目 (qa.bx) https://xone.qa.bx/project/createProject",
  }),
  "https://xone.qa.bx/project/createProject",
);

assert.equal(
  getPreferredChatPasteText({
    plainText: "项目 (qa.bx) https://xone.qa.bx/project/createProject",
  }),
  "https://xone.qa.bx/project/createProject",
);

assert.equal(
  getPreferredChatPasteText({
    plainText: "页签标题\nhttps://example.com/article",
    htmlText: '<a href="https://example.com/article">页签标题</a>',
  }),
  "https://example.com/article",
);

assert.equal(
  shouldDeletePendingAttachmentOnBackspace({
    cleanText: "",
    pendingFileCount: 1,
    key: "Backspace",
  }),
  true,
);

assert.equal(
  shouldDeletePendingAttachmentOnBackspace({
    cleanText: "hello",
    pendingFileCount: 1,
    key: "Backspace",
  }),
  false,
);

const ckEditorSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/CKEditor/index.tsx"),
  "utf8",
);
const nativePasteHandler = ckEditorSource
  .split("const listenPaste")[1]
  .split("const listenClipboardInput")[0];
assert.ok(
  !nativePasteHandler.includes("getPreferredChatPaste"),
  "text paste must not be handled by both the native paste and CKEditor clipboard handlers",
);
assert.equal(
  (ckEditorSource.match(/getPreferredChatPasteText/g) ?? []).length,
  2,
  "a pasted URL should have exactly one text insertion path",
);

console.log("chatInput tests passed");
