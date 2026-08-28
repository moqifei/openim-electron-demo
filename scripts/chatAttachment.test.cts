import assert = require("assert");

const { makeUniqueUploadFileName } = require("../src/utils/chatAttachment");

assert.equal(
  makeUniqueUploadFileName("screenshot.png", "pending-123"),
  "screenshot-pending-123.png",
);

assert.equal(
  makeUniqueUploadFileName("archive.tar.gz", "pending-123"),
  "archive.tar-pending-123.gz",
);

assert.equal(
  makeUniqueUploadFileName("clipboard", "pending-123"),
  "clipboard-pending-123",
);

console.log("chatAttachment tests passed");
