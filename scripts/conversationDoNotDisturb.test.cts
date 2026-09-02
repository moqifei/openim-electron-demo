const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { MessageReceiveOptType, SessionType } = require("@openim/wasm-client-sdk");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const { isConversationDoNotDisturb } = require(
  "../src/utils/conversationNotification.ts",
);

assert.equal(
  isConversationDoNotDisturb({ recvMsgOpt: MessageReceiveOptType.Normal }),
  false,
);
assert.equal(
  isConversationDoNotDisturb({ recvMsgOpt: MessageReceiveOptType.NotNotify }),
  true,
);
assert.equal(isConversationDoNotDisturb(undefined), false);

const groupSettings = read(
  "src/pages/chat/queryChat/GroupSetting/GroupSettings.tsx",
);
const groupSettingsHook = read(
  "src/pages/chat/queryChat/GroupSetting/useGroupSettings.tsx",
);
const conversationItem = read(
  "src/pages/chat/ConversationSider/ConversationItem.tsx",
);
const globalEvents = read("src/layout/useGlobalEvents.tsx");

assert.ok(
  groupSettings.includes("MessageReceiveOptType") &&
    groupSettings.includes('t("placeholder.notNotify")') &&
    groupSettings.includes("recvMsgOpt") &&
    groupSettings.includes("updateConversationNotification"),
  "group settings should expose the conversation notification switch",
);
assert.ok(
  groupSettingsHook.includes("IMSDK.setConversation") &&
    groupSettingsHook.includes("MessageReceiveOptType.NotNotify") &&
    groupSettingsHook.includes("MessageReceiveOptType.Normal"),
  "group settings should persist the notification option through the SDK",
);
assert.equal(SessionType.Group, SessionType.WorkingGroup);

assert.ok(
  conversationItem.includes("isConversationDoNotDisturb") &&
    conversationItem.includes("isConversationDoNotDisturb(conversation)") &&
    conversationItem.includes('aria-label={t("placeholder.notNotify")}') &&
    conversationItem.includes("conversation.unreadCount"),
  "conversation list should show the do-not-disturb marker without hiding unread count",
);
assert.ok(
  conversationItem.includes("BellOutlined") &&
    !conversationItem.includes("StopOutlined") &&
    conversationItem.includes("relative") &&
    conversationItem.includes("absolute") &&
    conversationItem.includes("rotate-45") &&
    conversationItem.includes("bg-[var(--text-tertiary)]") &&
    conversationItem.includes("left-1/2 top-1/2") &&
    conversationItem.includes("-translate-x-1/2 -translate-y-1/2") &&
    /flex min-w-0 items-center justify-between[\s\S]*?conversation\.unreadCount/.test(
      conversationItem,
    ),
  "conversation preview and unread count should share one bottom row with a bell and same-tone slash marker",
);

assert.ok(
  globalEvents.includes("isConversationDoNotDisturb") &&
    /const conversation = useConversationStore[\s\S]*?isConversationDoNotDisturb\(conversation\)[\s\S]*?requestMainWindowAttention/.test(
      globalEvents,
    ),
  "incoming reminders should be filtered before attention IPC",
);
assert.ok(
  /const conversation = await getConversationFromMessage\(message\);[\s\S]*?isConversationDoNotDisturb\(conversation\)[\s\S]*?showMainWindow/.test(
    globalEvents,
  ),
  "shake side effects should use the same do-not-disturb policy",
);
assert.ok(
  /handleNewMessage\(message\);\s*notifyIncomingMessage\(message\);/.test(
    globalEvents,
  ),
  "messages should still be processed before reminder filtering",
);

console.log("conversationDoNotDisturb tests passed");
