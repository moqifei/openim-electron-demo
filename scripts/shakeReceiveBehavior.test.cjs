const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (filePath) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const globalEvents = read("src/layout/useGlobalEvents.tsx");
const notificationMessage = read(
  "src/pages/chat/queryChat/NotificationMessage.tsx",
);
const imCommon = read("src/utils/imCommon.ts");
const windowManage = read("electron/main/windowManage.ts");
const ipcManage = read("electron/main/ipcHandlerManage.ts");

assert.match(
  globalEvents,
  /const handleShakeMessage = async \(message: MessageItem\) => \{[\s\S]*?if \(!conversation \|\| !canUseShake\(conversation, message\)\) return;[\s\S]*?showMainWindow[\s\S]*?await updateCurrentConversation\(\{ \.\.\.conversation \}\)[\s\S]*?navigate\(`\/chat\/\$\{conversation\.conversationID\}`\)[\s\S]*?ipcSend\("shakeMainWindow"/,
  "received shakes should open the matching chat and request a window shake",
);
assert.match(
  globalEvents,
  /newServerMsg\.sendID !== useUserStore\.getState\(\)\.selfInfo\.userID/,
  "self-sent shakes should not trigger receiver side effects",
);
assert.match(
  globalEvents,
  /isConversationDoNotDisturb\(conversation\)/,
  "received shakes should respect do-not-disturb conversations",
);
assert.match(
  globalEvents,
  /durationMs: SHAKE_DURATION_MS/,
  "received shakes should use the shared duration",
);
assert.match(
  notificationMessage,
  /getShakeMessageText\(message\.customElem\?\.data, message\.senderNickname\)/,
  "shake notifications should include the sender nickname",
);
assert.match(
  imCommon,
  /getShakeMessageText\(message\.customElem\?\.data, message\.senderNickname\)/,
  "conversation previews should include the sender nickname",
);
assert.match(windowManage, /const DEFAULT_SHAKE_DURATION_MS = 1000/);
assert.match(windowManage, /durationMs = DEFAULT_SHAKE_DURATION_MS/);
assert.match(ipcManage, /shakeMainWindow\(payload\?\.durationMs\)/);

console.log("shakeReceiveBehavior test passed");
