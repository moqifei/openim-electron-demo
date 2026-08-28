import assert = require("assert");
import fs = require("fs");
import path = require("path");

const globalEventsPath = path.join(process.cwd(), "src/layout/useGlobalEvents.tsx");
const notificationMessagePath = path.join(
  process.cwd(),
  "src/pages/chat/queryChat/NotificationMessage.tsx",
);
const imCommonPath = path.join(process.cwd(), "src/utils/imCommon.ts");
const windowManagePath = path.join(process.cwd(), "electron/main/windowManage.ts");
const ipcManagePath = path.join(process.cwd(), "electron/main/ipcHandlerManage.ts");

const globalEvents = fs.readFileSync(globalEventsPath, "utf8");
const notificationMessage = fs.readFileSync(notificationMessagePath, "utf8");
const imCommon = fs.readFileSync(imCommonPath, "utf8");
const windowManage = fs.readFileSync(windowManagePath, "utf8");
const ipcManage = fs.readFileSync(ipcManagePath, "utf8");

assert.ok(
  globalEvents.includes("const handleShakeMessage"),
  "received shake messages should use a dedicated handler",
);
assert.ok(
  globalEvents.includes("canUseShake(conversation)"),
  "received shake messages should filter by the shared conversation policy",
);
assert.ok(
  /if \(!conversation \|\| !canUseShake\(conversation, message\)\) return;/.test(
    globalEvents,
  ),
  "disallowed conversations should not trigger shake side effects",
);
assert.ok(
  globalEvents.includes('window.electronAPI?.ipcInvoke("showMainWindow")'),
  "received shake messages should show/focus the main window",
);
assert.ok(
  globalEvents.includes("await updateCurrentConversation({ ...conversation }"),
  "received shake messages should switch the active conversation",
);
assert.ok(
  globalEvents.includes("navigate(`/chat/${conversation.conversationID}`)"),
  "received shake messages should navigate to the active conversation route",
);
assert.ok(
  /ipcSend\("shakeMainWindow",\s*\{[\s\S]*?durationMs:\s*SHAKE_DURATION_MS[\s\S]*?\}\)/.test(
    globalEvents,
  ),
  "received shake messages should request a 1s shake",
);
assert.ok(
  notificationMessage.includes(
    "getShakeMessageText(message.customElem?.data, message.senderNickname)",
  ),
  "notification renderer should include the sender nickname",
);
assert.ok(
  imCommon.includes(
    "getShakeMessageText(message.customElem?.data, message.senderNickname)",
  ),
  "conversation preview should include the sender nickname",
);

assert.ok(windowManage.includes("const DEFAULT_SHAKE_DURATION_MS = 1000"));
assert.ok(windowManage.includes("durationMs = DEFAULT_SHAKE_DURATION_MS"));
assert.ok(ipcManage.includes("payload?: { durationMs?: number }"));
assert.ok(ipcManage.includes("shakeMainWindow(payload?.durationMs)"));

console.log("shakeReceiveBehavior tests passed");
