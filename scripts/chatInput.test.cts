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
  escapeChatPasteText(
    "<groupId>com.baixin</groupId>\n<artifactId>wealth-ops-backend</artifactId>",
  ),
  "&lt;groupId&gt;com.baixin&lt;/groupId&gt;<br>&lt;artifactId&gt;wealth-ops-backend&lt;/artifactId&gt;",
  "XML-like pasted text should remain visible after message rendering",
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
const textMessageRendererSource = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/MessageItem/TextMessageRender.tsx"),
  "utf8",
);
const ckEditorUtilsSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/CKEditor/utils.ts"),
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
assert.ok(
  textMessageRendererSource.includes("message.textElem?.content") &&
    textMessageRendererSource.includes("whiteSpace") &&
    !textMessageRendererSource.includes("dangerouslySetInnerHTML") &&
    !textMessageRendererSource.includes("escapeChatPasteText") &&
    !textMessageRendererSource.includes("formatBr"),
  "plain text messages must render the original content without HTML parsing",
);
assert.ok(
  textMessageRendererSource.includes("const ex: unknown = JSON.parse(message.ex)") &&
    textMessageRendererSource.includes('typeof ex === "object"') &&
    textMessageRendererSource.includes('typeof ex.fontSize === "number"'),
  "message font metadata parsing must narrow JSON.parse output before returning it",
);
assert.ok(
  ckEditorUtilsSource.includes("/<\\/p>\\s*<p>/g"),
  "editor paragraph separators should not leak structural indentation into sent text",
);
assert.ok(
  ckEditorUtilsSource.includes("/<br\\s*[/]?>[ \\t\\r\\n]*/gi"),
  "editor line-break separators should not leak trailing structural whitespace into sent text",
);
assert.ok(
  ckEditorUtilsSource.includes("/<p>[ \\t\\r\\n]*/gi") &&
    ckEditorUtilsSource.includes("/[ \\t\\r\\n]*<\\/p>/gi"),
  "editor paragraph wrappers should not leak indentation from inside paragraph tags",
);
const chatFooterSource = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatFooter/index.tsx"),
  "utf8",
);
const ckEditorComponentSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/CKEditor/index.tsx"),
  "utf8",
);
assert.ok(
  ckEditorComponentSource.includes("getText: () => string") &&
    chatFooterSource.includes("editorRef.current?.getText()") &&
    chatFooterSource.includes("sendText.trim()"),
  "message sending must use the editor model text instead of parsing editor HTML",
);

console.log("chatInput tests passed");
