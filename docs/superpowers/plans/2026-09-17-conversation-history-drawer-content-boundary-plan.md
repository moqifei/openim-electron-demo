# Conversation History Drawer Content Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the conversation-history drawer within the message panel so the bottom chat action bar remains visible and interactive.

**Architecture:** Add a dedicated, full-height DOM container inside the resizable `chat-main` panel. Mount only the conversation-history Drawer into that container and make the drawer root absolutely positioned relative to it. The footer remains outside that container and is not covered.

**Tech Stack:** React, TypeScript, Ant Design Drawer, react-resizable-panels, Playwright source tests.

## Global Constraints

- Keep the chat footer's resize behavior unchanged.
- Preserve existing local-history query, filtering, pagination, image preview, saving, and message-location behavior.
- Do not change other setting drawers that intentionally cover the whole chat container.

---

### Task 1: Bound the History Drawer to the Message Panel

**Files:**

- Modify: `src/pages/chat/queryChat/index.tsx`
- Modify: `src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx`
- Test: `e2e/conversationHistorySearch.spec.ts`

**Interfaces:**

- Produces: DOM container `#conversation-history-container`, owned by the `chat-main` panel.
- Consumes: Ant Design Drawer `getContainer` and `rootStyle` properties.

- [ ] **Step 1: Write the failing test**

```ts
expect(chatSource).toContain('id="conversation-history-container"');
expect(drawerSource).toContain('getContainer="#conversation-history-container"');
expect(drawerSource).toContain('rootStyle={{ position: "absolute" }}');
expect(drawerSource).not.toContain('getContainer="#chat-container"');
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts --workers=1 --reporter=line`

Expected: FAIL because the Drawer still mounts into `#chat-container`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
<Panel id="chat-main" order={0}>
  <div id="conversation-history-container" className="relative h-full">
    <ChatContent />
  </div>
</Panel>
```

```tsx
getContainer="#conversation-history-container"
rootStyle={{ position: "absolute" }}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts --workers=1 --reporter=line`

Expected: PASS.

- [ ] **Step 5: Run quality checks**

Run: `npx eslint src/pages/chat/queryChat/index.tsx src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx`

Run: `npx prettier --check src/pages/chat/queryChat/index.tsx src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx e2e/conversationHistorySearch.spec.ts`

Run: `git diff --check`

Expected: all commands exit with code `0`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/chat/queryChat/index.tsx src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx e2e/conversationHistorySearch.spec.ts docs/superpowers/plans/2026-09-17-conversation-history-drawer-content-boundary-plan.md
git commit -m "fix: keep conversation history above chat footer"
```
