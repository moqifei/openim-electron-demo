import assert = require("assert");
import fs = require("fs");
import path = require("path");

const filePath = path.join(
  process.cwd(),
  "src/pages/chat/queryChat/MessageItem/message-item.module.scss",
);
const source = fs.readFileSync(filePath, "utf8");

const actionToolbarMatch = source.match(/\.actionToolbar\s*\{([\s\S]*?)\n\s*\}/);
assert.ok(actionToolbarMatch, "actionToolbar style must exist");
const actionToolbar = actionToolbarMatch[1];

assert.ok(
  /left:\s*0;/.test(actionToolbar),
  "received-message toolbar should open to the right from the bubble left edge",
);
assert.ok(
  /right:\s*auto;/.test(actionToolbar),
  "received-message toolbar should not align to the bubble right edge",
);

const zIndexMatch = actionToolbar.match(/z-index:\s*(\d+);/);
assert.ok(zIndexMatch, "actionToolbar should define z-index");
assert.ok(Number(zIndexMatch[1]) >= 50, "actionToolbar should stay above messages");

const senderOverrideMatch = source.match(
  /&-sender\s*\{[\s\S]*?\.actionToolbar\s*\{([\s\S]*?)\n\s*\}/,
);
assert.ok(senderOverrideMatch, "sender messages should override toolbar alignment");
const senderOverride = senderOverrideMatch[1];
assert.ok(/right:\s*0;/.test(senderOverride));
assert.ok(/left:\s*auto;/.test(senderOverride));

console.log("messageActionToolbar tests passed");
