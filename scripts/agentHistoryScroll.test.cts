import assert = require("assert");
import fs = require("fs");
import path = require("path");

const chatContent = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatContent.tsx"),
  "utf8",
);

assert.ok(
  chatContent.includes("onScroll={handleChatScroll}"),
  "chat history should track actual scroll position",
);
assert.ok(
  chatContent.includes("followOutput={(isAtBottom) =>") &&
    chatContent.includes("!pauseStickyScroll.current"),
  "automatic output following should stop while the user reads history",
);
assert.ok(
  chatContent.includes("isUserViewingHistory.current"),
  "chat history should preserve an explicit user-reading state",
);

console.log("agentHistoryScroll tests passed");
