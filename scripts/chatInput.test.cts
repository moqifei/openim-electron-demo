import assert = require("assert");

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

console.log("chatInput tests passed");
