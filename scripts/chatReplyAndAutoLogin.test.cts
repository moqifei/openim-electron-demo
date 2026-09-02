import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const quoteRenderer = read(
  "src/pages/chat/queryChat/MessageItem/QuoteMessageRender.tsx",
);
const historyHook = read("src/pages/chat/queryChat/useHistoryMessageList.tsx");
const chatContent = read("src/pages/chat/queryChat/ChatContent.tsx");
const chatFooter = read("src/pages/chat/queryChat/ChatFooter/index.tsx");
const loginForm = read("src/pages/login/LoginForm.tsx");

const fileQuoteHandler = quoteRenderer
  .split("if (quoteMessage.contentType === MessageType.FileMessage)")[1]
  .split("if (quoteMessage.contentType === MessageType.")[0];

assert.match(
  fileQuoteHandler,
  /await jumpToOriginal\(quoteMessage\)/,
  "clicking a file reply should jump to the original file message",
);
assert.doesNotMatch(
  fileQuoteHandler,
  /downloadFileWithProgress/,
  "clicking a file reply should not download the file",
);
assert.match(
  historyHook,
  /export const loadAndFindMessage|findMessageAndLoad|ensureMessageLoaded/,
  "history hook should expose loading and finding a distant message",
);
assert.doesNotMatch(
  historyHook,
  /while\s*\(true\)/,
  "history message locator should not use a constant-condition loop",
);
assert.match(
  chatContent,
  /loadAndFindMessage|findMessageAndLoad|ensureMessageLoaded/,
  "chat content should use the history-loading message locator",
);
assert.match(
  quoteRenderer,
  /msg\.quoteElem\?\.quoteMessage/,
  "quote rendering should support nested replies",
);
assert.match(
  chatFooter,
  /msg\.quoteElem\?\.quoteMessage/,
  "the reply composer should preview nested replies",
);
assert.match(
  loginForm,
  /useEffect/,
  "login form should attempt automatic login on mount",
);
assert.match(
  loginForm,
  /rememberedLogin\.password/,
  "automatic login should use the remembered password",
);

console.log("chatReplyAndAutoLogin tests passed");
