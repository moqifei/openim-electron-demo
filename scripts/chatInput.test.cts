import assert = require("assert");
import fs = require("fs");
import path = require("path");

const {
  escapeChatPasteText,
  getPreferredChatPasteText,
  shouldDeletePendingAttachmentOnBackspace,
} = require("../src/utils/chatInput");

assert.equal(
  getPreferredChatPasteText({
    plainText:
      "providers:\n  custom:\n    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1\n    api_key: sk-example",
  }),
  "providers:\n  custom:\n    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1\n    api_key: sk-example",
);

assert.equal(
  escapeChatPasteText("第一行\n第二行\r\n第三行"),
  "第一行<br>第二行<br>第三行",
);
assert.equal(
  escapeChatPasteText("  第一行\n\t第二行"),
  "&nbsp;&nbsp;第一行<br>&nbsp;&nbsp;&nbsp;&nbsp;第二行",
  "pasted indentation should survive HTML conversion",
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
assert.ok(
  ckEditorSource.includes("escapeChatPasteText(pastedText)"),
  "CKEditor paste conversion must preserve line breaks",
);

console.log("chatInput tests passed");
