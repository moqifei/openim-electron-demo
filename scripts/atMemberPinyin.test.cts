import assert = require("assert");
import fs = require("fs");
import path = require("path");

const chatFooter = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatFooter/index.tsx"),
  "utf8",
);
const atPopup = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx",
  ),
  "utf8",
);
const ckEditor = fs.readFileSync(
  path.join(process.cwd(), "src/components/CKEditor/index.tsx"),
  "utf8",
);

assert.ok(chatFooter.includes('e?.key === "＠"'));
assert.ok(chatFooter.includes("atTriggerNeedsRemovalRef"));
assert.ok(atPopup.includes("toPinyin"));
assert.ok(atPopup.includes("getPinyinInitials"));
assert.ok(ckEditor.includes('domEvent?.key === "＠"'));
assert.ok(ckEditor.includes("replaceTextBeforeSelection"));

console.log("atMemberPinyin tests passed");
