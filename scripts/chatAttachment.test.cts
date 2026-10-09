import assert = require("assert");

const {
  isUploadFileNameAllowed,
  makeUniqueUploadFileName,
} = require("../src/utils/chatAttachment");

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

assert.equal(isUploadFileNameAllowed("项目 (2026) [final] - copy_2.docx"), true);
assert.equal(isUploadFileNameAllowed("《项目报告》.docx"), true);
for (const supportedCharacter of [
  " ",
  "&",
  ";",
  ":",
  "*",
  '"',
  "<",
  ">",
  "|",
  "{",
  "}",
  "`",
  "+",
  "=",
  "@",
  "!",
  "~",
  "（",
  "）",
  "，",
  "。",
]) {
  assert.equal(
    isUploadFileNameAllowed(`导入${supportedCharacter}文件.xlsx`),
    true,
    `should allow ${supportedCharacter}`,
  );
}
assert.equal(isUploadFileNameAllowed(""), false);

for (const unsupportedCharacter of ["%", "#", "?", "\\", "\t", "\n", "\r"]) {
  assert.equal(
    isUploadFileNameAllowed(`导入${unsupportedCharacter}.xlsx`),
    false,
    `should reject ${unsupportedCharacter}`,
  );
}

console.log("chatAttachment tests passed");
