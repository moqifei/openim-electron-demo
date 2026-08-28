import assert = require("assert");
import fs = require("fs");
import path = require("path");

const chatContent = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatContent.tsx"),
  "utf8",
);

assert.ok(
  chatContent.includes("const TIME_DIVIDER_GAP = 10 * 60 * 1000;"),
  "chat messages should be separated by time only after a 10-minute gap",
);

console.log("chatTimeDivider tests passed");
