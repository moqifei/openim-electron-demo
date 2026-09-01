import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/MessageItem/QuoteMessageRender.tsx",
  ),
  "utf8",
);
const pictureClickHandler = source
  .split("if (quoteMessage.contentType === MessageType.PictureMessage)")[1]
  .split("if (quoteMessage.contentType === MessageType.FileMessage)")[0];

assert.match(
  pictureClickHandler,
  /jumpToOriginal\(quoteMessage\)/,
  "clicking a picture reply should jump to the original picture message",
);
assert.doesNotMatch(
  pictureClickHandler,
  /setImagePreviewVisible\(true\)/,
  "clicking a picture reply must not only open a hidden preview",
);
assert.match(
  source,
  /className=\"[^\"]*quote-message-image[^\"]*\"/,
  "picture replies should show a thumbnail for identifying the original image",
);

console.log("quoteMessage tests passed");
