import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const conversationItem = read("src/pages/chat/ConversationSider/ConversationItem.tsx");
const conversationSort = read("src/utils/imCommon.ts");
const conversationSider = read("src/pages/chat/ConversationSider/index.tsx");
const globalEvents = read("src/layout/useGlobalEvents.tsx");

assert.ok(
  conversationItem.includes('styles["conversation-item-unread-right"]'),
  "conversation unread count should be rendered on the right side of the row",
);
assert.ok(
  !conversationItem.includes('styles["conversation-item-unread"]'),
  "conversation unread count should no longer be attached to the avatar",
);
assert.match(
  conversationSort,
  /const aUnread = a\.unreadCount > 0;[\s\S]*const bUnread = b\.unreadCount > 0;[\s\S]*if \(aUnread !== bUnread\)/,
  "conversation sorting should place unread conversations before read conversations",
);
assert.ok(
  conversationSider.includes("conversationSort(conversationList)"),
  "conversation list should render the unread-aware sorted list",
);
assert.ok(
  globalEvents.includes("const isMessagePageOpenRef = useRef(false);") &&
    globalEvents.includes("isMessagePageOpenRef.current = location.pathname.startsWith(\"/chat/\");") &&
    globalEvents.includes(
      "if (isMessagePageOpenRef.current && canAutoMarkConversationAsRead()) return;",
    ),
  "incoming reminders should be suppressed only while a foreground message page is open",
);

console.log("conversationUnreadAttention tests passed");
