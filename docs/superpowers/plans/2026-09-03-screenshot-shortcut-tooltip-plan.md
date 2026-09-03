# 截图按钮动态快捷键提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让截图操作栏的悬停提示始终显示客户端当前配置的截图快捷键。

**Architecture:** 将 `screenshotShortcut` 放入现有 `useUserStore.appSettings`，由 `MainContentWrap` 从 Electron store 初始化，设置页保存成功时更新该共享状态。截图操作栏使用共享的 `formatScreenshotShortcut` 工具生成 tooltip。

**Tech Stack:** React, TypeScript, Zustand, Electron IPC, Playwright tests.

## Global Constraints

- 只修改与截图快捷键状态、格式化和 tooltip 直接相关的代码。
- 保留默认快捷键 `CommandOrControl+Shift+X`。
- 展示格式为 `Ctrl + ...`，快捷键片段之间使用 `+`。
- 不修改 Electron 主进程快捷键注册和校验行为。

### Task 1: Add shared screenshot shortcut state and formatter

**Files:**

- Modify: `src/store/type.d.ts`
- Modify: `src/store/user.ts`
- Create: `src/utils/screenshotShortcut.ts`
- Modify: `src/layout/MainContentWrap.tsx`
- Test: `e2e/screenshotData.spec.ts`

- [x] **Step 1: Write the failing regression assertions**

  Update the screenshot tooltip test to require use of the shared shortcut state and formatter, and add a formatter assertion for `CommandOrControl+Alt+S`.

- [x] **Step 2: Run the focused test and verify it fails**

  Run: `npx playwright test e2e/screenshotData.spec.ts`

  Expected: the new dynamic tooltip assertion fails because the action bar still contains the fixed `Ctrl+Shift+X` title and no shared formatter exists.

- [x] **Step 3: Implement the minimal shared state and formatter**

  Add `screenshotShortcut: string` to `AppSettings`, initialize it to `CommandOrControl+Shift+X`, add `formatScreenshotShortcut(shortcut: string)`, and load the persisted shortcut in `MainContentWrap` alongside `closeAction`.

- [x] **Step 4: Run the focused test and verify it passes**

  Run: `npx playwright test e2e/screenshotData.spec.ts`

  Expected: all tests in the file pass.

### Task 2: Connect settings and screenshot tooltip to shared state

**Files:**

- Modify: `src/layout/LeftNavBar/PersonalSettings.tsx`
- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`
- Test: `e2e/screenshotData.spec.ts`

- [x] **Step 1: Use the shared setting in PersonalSettings**

  Read `appSettings.screenshotShortcut` from `useUserStore`, remove the component-local shortcut state and duplicate default, and call `updateAppSettings({ screenshotShortcut: savedShortcut })` after a successful IPC update.

- [x] **Step 2: Use the formatted shared setting in SendActionBar**

  Read `appSettings.screenshotShortcut` from `useUserStore`, import `formatScreenshotShortcut`, and set the screenshot image title to `${t("placeholder.screenshot")}（${formatScreenshotShortcut(screenshotShortcut)}）`.

- [x] **Step 3: Run focused tests**

  Run: `npx playwright test e2e/screenshotData.spec.ts`

  Expected: all screenshot tests pass, including the dynamic tooltip source assertion.

### Task 3: Verify the complete change

- [x] **Step 1: Run lint**

  Run: `npm run lint`

  Result: the full repository lint remains blocked by pre-existing errors in unrelated files; linting all files touched by this change exits with code 0 and warnings only.

- [x] **Step 2: Run the web build**

  Run: `npm run build`

  Expected: exit code 0 and Vite emits the production bundle.

- [x] **Step 3: Review the final diff**

  Run: `git diff --check; git status --short; git diff --stat`

  Expected: no whitespace errors, and only the planned state, formatter, settings, tooltip, test, and design/plan files are changed.
