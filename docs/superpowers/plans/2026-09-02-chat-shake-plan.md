# 抖一抖功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在单聊工具栏增加“抖一抖”入口，发送现有 `customType = 901` 自定义消息，并让接收方自动打开对应聊天页面及抖动主窗口。

**Architecture:** 复用 `src/utils/shakeMessage.ts` 的协议识别和单聊策略，复用 `IMSDK.createCustomMessage` 创建消息以及 `useSendMessage` 发送消息。接收端继续由 `useGlobalEvents` 定位会话、导航和触发既有 Electron 窗口抖动 IPC；不新增服务端接口、状态管理或独立信令。

**Tech Stack:** React, TypeScript, Vite, Ant Design, OpenIM WASM SDK, Electron IPC, CommonJS source-behavior tests.

## Global Constraints

- 仅支持单聊（`SessionType.Single`）。
- 群聊、工作群和智能体会话不显示“抖一抖”入口，也不响应抖动副作用。
- 复用现有的 `CustomMessage` 机制和 `customType = 901` 协议，不新增服务端接口或独立信令。
- 抖动消息保留在聊天消息历史中，并以通知消息形式展示，不显示为普通文本气泡。
- 发送方发送成功后本地窗口也触发一次抖动；接收方收到消息后同样触发一次抖动。
- 接收方若会话处于免打扰状态，不强制显示/聚焦窗口，也不触发窗口抖动。
- 窗口抖动时长沿用现有主进程默认值 1000ms。
- 保留工作区已有未提交改动，只修改本功能所需文件。

## File Map

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx` — 单聊工具栏入口、可用策略和抖动消息发送。
- Reuse: `src/utils/shakeMessage.ts` — `canUseShake`, `buildShakeMessageData`, `CHAT_SHAKE_TEXT`，不重复定义协议。
- Reuse/verify: `src/layout/useGlobalEvents.tsx` — 已有接收、会话跳转和窗口抖动流程；只有测试证明缺口时才做最小修正。
- Reuse/verify: `src/pages/chat/queryChat/NotificationMessage.tsx`, `src/utils/imCommon.ts`, `electron/main/windowManage.ts`, `electron/main/ipcHandlerManage.ts` — 已有通知文案和窗口抖动链路。
- Create: `scripts/shakeSendBehavior.test.cjs` — 可直接由 Node 运行的发送入口行为测试；不改动已有的 `scripts/shakeSendBehavior.test.cts` 用户文件。
- Create: `scripts/shakeReceiveBehavior.test.cjs` — Node 24 可直接运行的接收链路源码行为检查，不改动已有的 `.cts` 用户测试。
- Verify: `scripts/shakeReceiveBehavior.test.cts` and relevant existing scripts — 接收链路回归验证；`.cts` 测试若被 Node 运行器拒绝时，以新增 `.cjs` 检查作为可重复的运行结果。

---

### Task 1: Add runnable red tests for the shake message paths

**Files:**

- Create: `scripts/shakeSendBehavior.test.cjs`
- Create: `scripts/shakeReceiveBehavior.test.cjs`
- Read-only reference: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`
- Read-only references: `src/layout/useGlobalEvents.tsx`, `src/pages/chat/queryChat/NotificationMessage.tsx`, `src/utils/imCommon.ts`, `electron/main/windowManage.ts`, `electron/main/ipcHandlerManage.ts`

**Interfaces:**

- Consumes: source text from `SendActionBar` and the existing shared names `canUseShake`, `buildShakeMessageData`, `CHAT_SHAKE_TEXT`, `IMSDK.createCustomMessage`, and `sendMessage`.
- Produces: Node-runnable regression tests that fail when the send entry is missing and verify the already-present receive/open/shake contract.

- [ ] **Step 1: Write the failing test**

Create a plain CommonJS test so Node 24 does not reject TypeScript `import = require` syntax:

```js
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
  ),
  "utf8",
);

assert.match(
  source,
  /import \{[\s\S]*canUseShake[\s\S]*\} from "@\/utils\/shakeMessage"/,
  "send action bar should use the shared shake policy",
);
assert.match(
  source,
  /const currentConversation = useConversationStore[\s\S]*?currentConversation/,
  "send action bar should read the active conversation",
);
assert.match(
  source,
  /const canSendShake = canUseShake\(currentConversation\)/,
  "send action bar should compute the shake visibility policy",
);
assert.match(
  source,
  /canSendShake\s*&&\s*\([\s\S]*?title="抖一抖"/,
  "shake button should only render when the policy allows it",
);
assert.match(
  source,
  /const handleShake = async \(\) => \{[\s\S]*?if \(!canSendShake\) return;[\s\S]*?createCustomMessage[\s\S]*?buildShakeMessageData\(\)[\s\S]*?CHAT_SHAKE_TEXT[\s\S]*?sendMessage\(\{[\s\S]*?message[\s\S]*?recvID:/,
  "shake handler should create and send the 901 custom message to the active peer",
);

console.log("shakeSendBehavior test passed");
```

- [ ] **Step 2: Run the test to verify it fails for the missing feature**

Run: `node scripts/shakeSendBehavior.test.cjs`

Expected: FAIL with an assertion showing that `SendActionBar` does not yet import/use `canUseShake` or render the `抖一抖` handler. This is the intended red state; a syntax/runtime error means the test itself must be corrected before implementation.

- [ ] **Step 3: Keep the test isolated from unrelated worktree changes**

Run: `git status --short -- scripts/shakeSendBehavior.test.cjs src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`.

Expected: only the new test is untracked at this point; existing modifications to the TypeScript test and other files remain untouched.

- [ ] **Step 4: Add a Node-runnable receive contract test**

Create `scripts/shakeReceiveBehavior.test.cjs` with these exact assertions:

```js
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (filePath) => fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const globalEvents = read("src/layout/useGlobalEvents.tsx");
const notificationMessage = read("src/pages/chat/queryChat/NotificationMessage.tsx");
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
```

- [ ] **Step 5: Run the receive test before implementation**

Run: `node scripts/shakeReceiveBehavior.test.cjs`.

Expected: PASS, because the receive/open/shake path already exists. If it fails, stop implementation and correct only the receive-path mismatch required by the approved design before proceeding to Task 2.

### Task 2: Implement the single-chat send action

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`
- Test: `scripts/shakeSendBehavior.test.cjs`

**Interfaces:**

- Consumes: `useConversationStore`, `SendMessageParams`, `IMSDK.createCustomMessage`, `buildShakeMessageData`, `canUseShake`, `CHAT_SHAKE_TEXT`.
- Produces: `SendActionBar` renders a guarded button, sends `CustomMessage` data `{ customType: 901 }` to `currentConversation.userID`, and requests one local window shake.

- [ ] **Step 1: Add only the imports required by the existing SDK pattern**

Change the imports at the top of `SendActionBar/index.tsx` to include the Ant Design icon, `IMSDK`, and the shared shake helpers:

```tsx
import { ThunderboltOutlined } from "@ant-design/icons";
import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover, Slider, Upload } from "antd";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, RefObject, useState } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import cardIcon from "@/assets/images/chatFooter/card.png";
import cutIcon from "@/assets/images/chatFooter/cut.png";
import emojiIcon from "@/assets/images/chatFooter/emoji.png";
import fileIcon from "@/assets/images/chatFooter/file.png";
import image from "@/assets/images/chatFooter/image.png";
import { CKEditorRef } from "@/components/CKEditor";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store/conversation";
import {
  buildShakeMessageData,
  canUseShake,
  CHAT_SHAKE_TEXT,
} from "@/utils/shakeMessage";

import { SendMessageParams } from "../useSendMessage";
import EmojiPicker from "./EmojiPicker";
import ShareCardModal from "./ShareCardModal";
```

Keep all unrelated imports and formatting unchanged.

- [ ] **Step 2: Read the active conversation and derive the shared visibility policy**

Immediately after the existing font-size store selectors, add:

```tsx
const currentConversation = useConversationStore((state) => state.currentConversation);
const canSendShake = canUseShake(currentConversation);
```

This makes the existing policy the single source of truth: only a `SessionType.Single` conversation that is not an agent conversation can show the action.

- [ ] **Step 3: Add the guarded async handler**

After `handleCardSelect`, add:

```tsx
const handleShake = async () => {
  if (!canSendShake || !currentConversation?.userID) return;
  try {
    const { data: message } = await IMSDK.createCustomMessage({
      data: buildShakeMessageData(),
      extension: "",
      description: CHAT_SHAKE_TEXT,
    });
    await sendMessage({
      message,
      recvID: currentConversation.userID,
      groupID: "",
    });
  } catch (error) {
    console.error("[SendActionBar] send shake failed:", error);
    antdMessage.error(t("toast.accessFailed"));
  }
};
```

The explicit `recvID` prevents an asynchronous conversation switch from sending to the wrong target. The existing `useSendMessage` hook remains responsible for local insertion, SDK send failure status, and normal message bookkeeping.

After `await sendMessage(...)` returns, call `window.electronAPI?.ipcSend("shakeMainWindow", { durationMs: 1000 })` so the sender gets the same local feedback as the receiver. Keep the existing receiver-side IPC call unchanged; each client performs one shake for the same event.

- [ ] **Step 4: Render the action only for allowed single chats**

In the existing toolbar `<div>`, before `sendActionList.map(...)`, add:

```tsx
{
  canSendShake && (
    <div
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
      title="抖一抖"
      aria-label="抖一抖"
      onClick={() => {
        void handleShake();
      }}
    >
      <ThunderboltOutlined />
    </div>
  );
}
```

Do not add a disabled group-chat button: the element must be absent when `canSendShake` is false.

- [ ] **Step 5: Run the red test again and verify green**

Run: `node scripts/shakeSendBehavior.test.cjs`.

Expected: `shakeSendBehavior test passed`.

- [ ] **Step 6: Run TypeScript-aware project validation for this file**

Run: `npm run lint -- --no-ignore src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`.

Expected: exit code 0 with no new lint errors. If the project ESLint script does not accept a file argument, run `npm run lint` and inspect that any reported issues are unrelated before continuing.

### Task 3: Verify the receive/open/shake path and integration boundaries

**Files:**

- Read/verify: `src/layout/useGlobalEvents.tsx`
- Read/verify: `src/pages/chat/queryChat/NotificationMessage.tsx`
- Read/verify: `src/utils/imCommon.ts`
- Read/verify: `electron/main/windowManage.ts`
- Read/verify: `electron/main/ipcHandlerManage.ts`
- Test: existing `scripts/shakeReceiveBehavior.test.cts` and relevant `scripts/*.test.cts`

**Interfaces:**

- Consumes: the sent message from Task 2 and the existing receive contract `customType = 901`.
- Produces: evidence that the receiver ignores self messages, respects the shared single-chat and do-not-disturb policy, navigates to `/chat/:conversationID`, and requests a 1000ms shake.

- [ ] **Step 1: Inspect the receive path before changing anything**

Run:

```powershell
rg -n -C 12 "handleShakeMessage|isShakeMessageData|showMainWindow|navigate\(`/chat/|shakeMainWindow|isConversationDoNotDisturb" src/layout/useGlobalEvents.tsx
rg -n -C 8 "getShakeMessageText|isShakeMessageData" src/pages/chat/queryChat/NotificationMessage.tsx src/utils/imCommon.ts
rg -n -C 8 "DEFAULT_SHAKE_DURATION_MS|shakeMainWindowEffect|shakeMainWindow" electron/main/windowManage.ts electron/main/ipcHandlerManage.ts src/layout/MainContentLayout.tsx
```

Expected: the existing receive code remains aligned with the approved design. Do not alter these files if the checks pass.

- [ ] **Step 2: Run the existing receive behavior test with the project-supported TypeScript runner**

First run: `node scripts/shakeReceiveBehavior.test.cts`.

Expected: Node may report `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` for `import = require`; this is a test-runner limitation, while `node scripts/shakeReceiveBehavior.test.cjs` is the executable receive-path result. The assertions must confirm `showMainWindow`, conversation update, route navigation, `shakeMainWindow`, notification text, and 1000ms duration.

- [ ] **Step 3: Run the relevant existing behavior checks**

Run:

```powershell
node scripts/conversationDoNotDisturb.test.cts
node scripts/messageActionToolbar.test.cts
```

Expected: tests that are Node-compatible pass. If `.cts` syntax prevents execution, separate runner failures from assertion failures and continue with build/lint evidence.

- [ ] **Step 4: Run full lint and production build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit 0. The build must include the new toolbar code without TypeScript or bundler errors.

- [ ] **Step 5: Perform the focused manual acceptance check**

Use two logged-in client instances in a single chat:

1. Confirm the sender's single-chat toolbar shows `抖一抖`.
2. Click it once and confirm the sender window also visibly shakes for about one second after the send flow.
3. Confirm the receiver window becomes visible/focused, route changes to the sender's conversation, and the receiver main window visibly shakes for about one second.
4. Confirm group chat and agent chat toolbars do not show the action.
5. Mark a single conversation as do-not-disturb, send another shake, and confirm the message can arrive without forced window opening or shaking.

- [ ] **Step 6: Review the final diff and report repository permission constraints**

Run: `git diff -- src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx scripts/shakeSendBehavior.test.cjs` and `git status --short`.

Expected: the diff contains only the toolbar implementation and its focused test; pre-existing user changes remain present. Attempt a focused commit only if `.git` is writable; if `index.lock` creation is denied as during design documentation, report that the files are ready but uncommitted.

## Self-Review Checklist

- Spec coverage: Task 2 covers single-chat visibility, protocol reuse, send target, sender local shake, and no group/agent entry; Task 3 covers receiver navigation, window focus, receiver shake duration, notification text, do-not-disturb, build, lint, and manual acceptance for both windows.
- Placeholder scan: every implementation step contains its target file, exact behavior, command, and expected result.
- Type consistency: `SendMessageParams` accepts `message`, `recvID`, and `groupID`; `IMSDK.createCustomMessage` accepts `data`, `extension`, and `description`; all names match installed SDK and current source.
- Scope: no new service API, IPC channel, state store, asset, or unrelated refactor is planned.
