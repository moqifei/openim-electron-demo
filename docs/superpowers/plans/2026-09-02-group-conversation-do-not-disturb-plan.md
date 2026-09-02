# 群聊消息免打扰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为普通群和工作群增加可跨客户端同步的会话级消息免打扰设置，并屏蔽三类消息提醒而保留消息接收和未读数。

**Architecture:** 使用 OpenIM SDK `ConversationItem.recvMsgOpt` 作为唯一状态来源。群聊设置调用 `IMSDK.setConversation({ conversationID, recvMsgOpt })`，现有会话变更事件负责同步状态；统一消息提醒函数读取会话状态并在 `NotNotify` 时返回。会话列表和设置面板均直接从当前会话/列表对象派生显示状态。

**Tech Stack:** React, TypeScript, Zustand, Ant Design, OpenIM WASM Client SDK, Node `.cts` source-contract tests.

## Global Constraints

- 普通群 `SessionType.Group` 和工作群 `SessionType.WorkingGroup` 必须共用并支持同一逻辑。
- 开启免打扰使用 `MessageReceiveOptType.NotNotify`，关闭使用 `MessageReceiveOptType.Normal`。
- 免打扰只屏蔽提醒，不得阻止消息接收、会话更新或未读数累计。
- 不增加本地缓存，不修改群资料，不引入新依赖。
- 保留工作区已有未提交改动，只修改与本需求直接相关的内容。

## 文件地图

- Modify: `src/pages/chat/queryChat/GroupSetting/GroupSettings.tsx` — 增加群聊会话免打扰开关。
- Modify: `src/pages/chat/queryChat/GroupSetting/useGroupSettings.tsx` — 封装会话免打扰 SDK 更新和当前会话状态更新。
- Modify: `src/pages/chat/ConversationSider/ConversationItem.tsx` — 显示免打扰标识。
- Modify: `src/layout/useGlobalEvents.tsx` — 在统一提醒入口过滤免打扰，并限制抖一抖副作用。
- Modify: `src/i18n/resources/zh.json` — 增加/复用群聊免打扰提示文案。
- Modify: `src/i18n/resources/en.json` — 增加/复用群聊免打扰提示文案。
- Create: `src/utils/conversationNotification.ts` — 提供可测试的会话免打扰判断函数。
- Create: `scripts/conversationDoNotDisturb.test.cts` — 验证纯函数和源码接线契约。

### Task 1: Add the failing conversation policy test

**Files:**

- Create: `scripts/conversationDoNotDisturb.test.cts`
- Create: `src/utils/conversationNotification.ts`

**Interfaces:**

- Produces `isConversationDoNotDisturb(conversation?: { recvMsgOpt?: MessageReceiveOptType }): boolean` for UI and reminder code.

- [ ] **Step 1: Write the failing test**

Add assertions for `Normal`, `NotNotify`, missing conversations, and source contracts requiring both message reminder filtering and shared shake-policy use. The test must expect the new utility module and the new source references before production code exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: FAIL because `src/utils/conversationNotification.ts` does not exist and the source contracts are not yet present.

- [ ] **Step 3: Write minimal implementation**

Create `conversationNotification.ts` importing `MessageReceiveOptType` and returning `conversation?.recvMsgOpt === MessageReceiveOptType.NotNotify`.

- [ ] **Step 4: Run test to verify the utility behavior passes**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: utility assertions pass while source-contract assertions remain red until later tasks.

### Task 2: Wire the group settings switch to the SDK

**Files:**

- Modify: `src/pages/chat/queryChat/GroupSetting/useGroupSettings.tsx`
- Modify: `src/pages/chat/queryChat/GroupSetting/GroupSettings.tsx`
- Modify: `src/i18n/resources/zh.json`
- Modify: `src/i18n/resources/en.json`
- Test: `scripts/conversationDoNotDisturb.test.cts`

**Interfaces:**

- Consumes `currentConversation` from `useConversationStore` and `MessageReceiveOptType` from OpenIM SDK.
- Produces `updateConversationNotification(checked: boolean): Promise<void>` for the settings row.

- [ ] **Step 1: Extend the failing test**

Assert that the group settings source imports `MessageReceiveOptType`, renders a `SettingRow` titled with the existing `placeholder.notNotify` key, passes the current conversation `recvMsgOpt`, and calls `updateConversationNotification`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: FAIL on the missing settings source contract.

- [ ] **Step 3: Implement the minimal SDK-backed switch**

In `useGroupSettings`, read `currentConversation` and add:

```ts
const updateConversationNotification = useCallback(
  async (checked: boolean) => {
    if (!currentConversation?.conversationID) return;
    try {
      await IMSDK.setConversation({
        conversationID: currentConversation.conversationID,
        recvMsgOpt: checked
          ? MessageReceiveOptType.NotNotify
          : MessageReceiveOptType.Normal,
      });
      useConversationStore.setState((state) => {
        const nextConversation =
          state.currentConversation?.conversationID ===
          currentConversation.conversationID
            ? {
                ...state.currentConversation,
                recvMsgOpt: checked
                  ? MessageReceiveOptType.NotNotify
                  : MessageReceiveOptType.Normal,
              }
            : state.currentConversation;
        return { currentConversation: nextConversation };
      });
    } catch (error) {
      feedbackToast({ error, msg: t("toast.updateConversationFailed") });
    }
  },
  [currentConversation?.conversationID],
);
```

Return it from the hook. In `GroupSettings`, render a `SettingRow` after the first divider with `value={currentConversation?.recvMsgOpt === MessageReceiveOptType.NotNotify}` and `tryChange={updateConversationNotification}`. Use the existing `notNotify` translation key; add only an error translation if none exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: settings source assertions pass.

### Task 3: Show the synchronized state in the conversation list

**Files:**

- Modify: `src/pages/chat/ConversationSider/ConversationItem.tsx`
- Test: `scripts/conversationDoNotDisturb.test.cts`

**Interfaces:**

- Consumes `conversation.recvMsgOpt` and `isConversationDoNotDisturb`.
- Produces a right-side visual marker without changing unread count rendering.

- [ ] **Step 1: Extend the failing test**

Assert that `ConversationItem.tsx` imports the policy helper, derives the muted state from `conversation`, renders an accessible/title-marked indicator, and still renders `conversation.unreadCount`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: FAIL because the list item has no policy helper or indicator.

- [ ] **Step 3: Implement the minimal indicator**

Import `SoundOutlined` (or another existing Ant Design icon) and the helper. Add `const isDoNotDisturb = isConversationDoNotDisturb(conversation);`. Render a small muted icon in the existing right-side metadata column before the unread badge, with `title={t("placeholder.notNotify")}` and `aria-label={t("placeholder.notNotify")}`. Keep the unread badge unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: list indicator assertions pass.

### Task 4: Filter all incoming reminders, including shake side effects

**Files:**

- Modify: `src/layout/useGlobalEvents.tsx`
- Test: `scripts/conversationDoNotDisturb.test.cts`

**Interfaces:**

- Consumes `isConversationDoNotDisturb` and the existing conversation lookup.
- Produces no attention IPC, notification IPC, tray reminder, window shake, or auto-navigation for a muted conversation, while leaving `handleNewMessage` intact.

- [ ] **Step 1: Extend the failing test**

Assert that the source imports the helper, checks the conversation before `requestMainWindowAttention` and `notifyIncomingMessage`, and checks the resolved conversation in `handleShakeMessage` before showing/focusing/navigating/shaking. Assert that `handleNewMessage` remains called by the new-message handler.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: FAIL because reminder and shake paths do not yet use the helper.

- [ ] **Step 3: Implement the minimal shared filtering**

In `handleShakeMessage`, after resolving the conversation, return when `isConversationDoNotDisturb(conversation)` is true before any window/show/navigation/IPC side effect. In `notifyIncomingMessage`, resolve the conversation before computing title/body and return when the helper says muted. Keep `handleNewMessage(message)` before `notifyIncomingMessage(message)` so messages still reach the active chat.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: all source-contract assertions pass.

### Task 5: Run full verification

**Files:**

- No new files; inspect the complete diff.

- [ ] **Step 1: Run the focused tests**

Run: `node --experimental-strip-types scripts/conversationDoNotDisturb.test.cts`

Expected: `conversationDoNotDisturb tests passed`.

- [ ] **Step 2: Run the existing related reminder tests**

Run: `node --experimental-strip-types scripts/conversationUnreadAttention.test.cts; node --experimental-strip-types scripts/taskbarMessageAttention.test.cts; node --experimental-strip-types scripts/shakeReceiveBehavior.test.cts`

Expected: all three existing tests pass.

- [ ] **Step 3: Run type checking and lint**

Run: `npx tsc --noEmit; npm run lint`

Expected: both commands exit with code 0 and report no errors.

- [ ] **Step 4: Review the diff and workspace safety**

Run: `git diff -- src/pages/chat/queryChat/GroupSetting/useGroupSettings.tsx src/pages/chat/queryChat/GroupSetting/GroupSettings.tsx src/pages/chat/ConversationSider/ConversationItem.tsx src/layout/useGlobalEvents.tsx src/i18n/resources/zh.json src/i18n/resources/en.json src/utils/conversationNotification.ts scripts/conversationDoNotDisturb.test.cts docs/superpowers/specs/2026-09-02-group-conversation-do-not-disturb-design.md docs/superpowers/plans/2026-09-02-group-conversation-do-not-disturb-plan.md`

Expected: only requested UI, SDK, reminder-policy, translations, tests, and task docs are changed; pre-existing unrelated modifications remain untouched.
