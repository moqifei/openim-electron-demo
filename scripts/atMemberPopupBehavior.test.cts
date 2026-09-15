import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const popup = read("src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx");
const footer = read("src/pages/chat/queryChat/ChatFooter/index.tsx");

assert.equal(
  (popup.match(/onKeyDown=\{handleKeyDown\}/g) ?? []).length,
  1,
  "the @ popup must handle each key once, from its focused search input",
);
assert.match(
  popup,
  /document\.addEventListener\("pointerdown", handlePointerDown\)/,
  "clicking outside the popup must close it",
);
assert.match(
  popup,
  /const itemRefs = useRef\(new Map<number, HTMLDivElement>\(\)\);/,
  "the popup must retain DOM references for keyboard-selected rows",
);
assert.match(
  popup,
  /itemRefs\.current\.get\(activeIndex\)\?\.scrollIntoView\(\{ block: "nearest" \}\)/,
  "keyboard navigation must keep the active mention row visible",
);
assert.match(
  footer,
  /useEffect\(\(\) => \{[\s\S]*?atPopupRequestIdRef\.current \+= 1;[\s\S]*?setAtPopupVisible\(false\);[\s\S]*?\}, \[currentConversation\?\.conversationID\]\)/,
  "switching conversations must close the popup and invalidate a pending member request",
);

console.log("atMemberPopupBehavior tests passed");
