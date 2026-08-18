# 截图按钮快捷键提示 Implementation Plan

> **For agentic workers:** Execute this single task inline and verify each command before reporting completion.

**Goal:** 为聊天输入区截图图标增加 `截图（Ctrl+Shift+X）` 悬停提示。

**Architecture:** 仅修改截图图标所在的 React `img` 元素，使用 HTML `title` 提供原生悬停提示。现有截图点击回调与快捷键行为不变。

**Tech Stack:** React 18、TypeScript、Vite、Playwright。

## Global Constraints

- 文案必须精确为 `截图（Ctrl+Shift+X）`。
- 只修改截图按钮提示相关代码，不重构相邻组件。
- 保留并通过 `e2e/screenshotData.spec.ts` 中现有的截图提示回归测试。

---

### Task 1: 增加截图图标悬停提示

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`，截图分支中的 `img` 元素
- Test: `e2e/screenshotData.spec.ts`，复用现有 `shows the global shortcut in the screenshot button hover text` 测试

**Interfaces:**

- Consumes: 现有 `cutIcon`、`t("placeholder.screenshot")` 和 `handleScreenshotClick`。
- Produces: 截图图标的 DOM 属性 `title="截图（Ctrl+Shift+X）"`。

- [ ] **Step 1: 运行现有测试确认当前缺少提示**

Run: `npx playwright test e2e/screenshotData.spec.ts`

Expected: 仅截图按钮提示测试因 `SendActionBar/index.tsx` 尚未包含目标 `title` 而失败，其余测试结果用于确认测试环境状态。

- [ ] **Step 2: 添加最小实现**

在截图分支的 `<img>` 上增加：

```tsx
title = "截图（Ctrl+Shift+X）";
```

不修改 `alt`、`onClick` 或截图配置菜单。

- [ ] **Step 3: 运行回归测试、lint 和构建**

Run: `npx playwright test e2e/screenshotData.spec.ts`

Expected: 截图辅助测试全部通过。

Run: `npm run lint`

Expected: ESLint 退出码为 0。

Run: `npm run build`

Expected: Vite 构建退出码为 0。
