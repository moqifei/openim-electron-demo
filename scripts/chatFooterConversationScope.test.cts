import assert = require("assert");
import fs = require("fs");
import path = require("path");

const footer = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatFooter/index.tsx"),
  "utf8",
);

assert.ok(
  footer.includes("const sendTarget =") &&
    footer.includes("recvID: currentConversation?.userID") &&
    footer.includes("groupID: currentConversation?.groupID") &&
    footer.includes("sendMessage({ message: msg, ...sendTarget })"),
  "pending file sends should keep the conversation target captured at send time",
);
assert.ok(
  footer.includes("pendingFilesByConversation") &&
    footer.includes("pendingFilesKey") &&
    footer.includes("pendingFilesByConversationRef") &&
    footer.includes("URL.revokeObjectURL(item.previewUrl)"),
  "pending file attachments should be isolated and restored per conversation",
);

console.log("chatFooterConversationScope tests passed");
