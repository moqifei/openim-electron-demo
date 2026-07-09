import assert = require("assert");

const {
  isUploadedObjectURL,
  isPreUploadedMediaMessage,
} = require("../src/pages/chat/queryChat/ChatFooter/messageUploadState");

const PictureMessage = 102;
const FileMessage = 105;

assert.equal(isUploadedObjectURL("https://example.com/a.png"), true);
assert.equal(isUploadedObjectURL("/object/u/a.png"), true);
assert.equal(isUploadedObjectURL("4712685701/image_1779798903685.png"), true);
assert.equal(isUploadedObjectURL("data:image/png;base64,abc"), false);
assert.equal(isUploadedObjectURL("blob:http://localhost/abc"), false);
assert.equal(isUploadedObjectURL("C:\\Users\\zy\\Desktop\\a.png"), false);

assert.equal(
  isPreUploadedMediaMessage({
    contentType: PictureMessage,
    pictureElem: {
      sourcePicture: {
        url: "4712685701/image_1779798903685.png",
      },
    },
  }),
  true,
);

assert.equal(
  isPreUploadedMediaMessage({
    contentType: FileMessage,
    fileElem: {
      sourceUrl: "4712685701/report.pdf",
    },
  }),
  true,
);

console.log("messageUploadState tests passed");
