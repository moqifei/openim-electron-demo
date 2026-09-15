# Chat Popup Scroll and Merge Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the compact Chinese screenshot setting presentation, keep the active group mention row visible during keyboard navigation, and make a merged-record image preview use the same image as its thumbnail.

**Architecture:** Keep all screenshot preference behavior intact and only restore its historical presentation in `SendActionBar`. The mention popup owns the active item and list scrolling, so it will retain item refs and scroll the active item into the list's nearest visible position. Merge-detail images will use one resolved display URL for both thumbnail and Ant Design preview while the separate copy action continues to prefer the original URL.

**Tech Stack:** React 18, TypeScript, Ant Design, CSS modules, Node `assert` source-contract tests.

## Global Constraints

- Preserve `screenshotHideWindow` storage and the existing renderer/main-process screenshot semantics.
- Restore the historical Chinese text exactly as `截图时隐藏窗口`.
- Do not change normal chat image gallery behavior or merge-detail image clipboard fidelity.
- Keep native download changes outside this task untouched.
- Leave all task changes staged when complete, and do not create a Git commit.

---

### Task 1: Restore Compact Screenshot Setting UI

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`
- Test: `e2e/screenshotData.spec.ts`

**Interfaces:**

- Consumes: `hideWindowConfig` state and `localStorage.screenshotHideWindow`.
- Produces: the existing `onScreenshot(hideWindow: boolean)` callback and compact Popover trigger/content.

- [ ] **Step 1: Extend the source-contract test**

Assert that the action bar contains the historical exact Chinese label, compact `h-4 w-4` custom checkbox, and `viewBox="0 0 8 8"` trigger arrow.

- [ ] **Step 2: Run the screenshot contract test and verify it fails**

Run: `npx playwright test e2e/screenshotData.spec.ts`

Expected: the new contract fails because the source currently renders Ant Design `Checkbox` and `DownOutlined`.

- [ ] **Step 3: Restore the historical compact markup**

Replace the Ant Design checkbox and arrow button with the previous custom clickable row and tiny SVG arrow. The click handler toggles the stored boolean; the screenshot icon continues passing the same boolean to `onScreenshot`.

- [ ] **Step 4: Run the screenshot contract test**

Run: `npx playwright test e2e/screenshotData.spec.ts`

Expected: all screenshot contract cases pass.

### Task 2: Keep Keyboard-Selected Mention Rows Visible

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx`
- Test: `scripts/atMemberPopupBehavior.test.cts`

**Interfaces:**

- Consumes: `activeIndex` where `0` is `@所有人` and positive values map to `filtered[index - 1]`.
- Produces: refs for every visible candidate row and `scrollIntoView({ block: "nearest" })` when a row becomes active.

- [ ] **Step 1: Extend the failing mention-popup contract**

Assert that the popup owns a list/item reference map and an active-index effect that invokes `scrollIntoView` using `block: "nearest"`.

- [ ] **Step 2: Run the mention-popup contract and verify it fails**

Run: `node --require ts-node/register/transpile-only scripts/atMemberPopupBehavior.test.cts`

Expected: the new scroll assertion fails because the selected row only receives an active CSS class today.

- [ ] **Step 3: Add visible-row scrolling**

Use a callback ref keyed by active-index row number for the `@所有人` row and member rows. When `activeIndex` changes while visible, call `scrollIntoView({ block: "nearest" })` on the current row. Do not change navigation arithmetic.

- [ ] **Step 4: Run the mention-popup contract**

Run: `node --require ts-node/register/transpile-only scripts/atMemberPopupBehavior.test.cts`

Expected: the contract passes and existing single-dispatch/outside-click assertions remain green.

### Task 3: Align Merge Detail Preview With the Rendered Picture

**Files:**

- Modify: `src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx`
- Test: `scripts/mergeForwardDetail.test.cts`

**Interfaces:**

- Consumes: `snapshotPicture.url`, `sourcePicture.url`, and `copyImageToClipboard`.
- Produces: one `displayUrl` passed to both `<Image src>` and `preview.src`; copy keeps the original-URL fallback chain.

- [ ] **Step 1: Extend the failing merge-detail contract**

Assert that the detail component declares `displayUrl` from snapshot then source and that both `<Image src>` and `preview={{ src: displayUrl }}` use it, while `copyImageToClipboard` retains the original URL.

- [ ] **Step 2: Run the merge-detail contract and verify it fails**

Run: `node --require ts-node/register/transpile-only scripts/mergeForwardDetail.test.cts`

Expected: the preview assertion fails because it currently uses a separate `orig` URL.

- [ ] **Step 3: Make the preview use the same resolved picture URL**

Rename the thumbnail URL to `displayUrl`, use it for `Image.src` and `preview.src`, and leave `orig` for the copy button only.

- [ ] **Step 4: Run merge-detail and image-copy contracts**

Run: `node --require ts-node/register/transpile-only scripts/mergeForwardDetail.test.cts`

Run: `node --require ts-node/register/transpile-only scripts/imageMessageCopy.test.cts`

Expected: both pass.

### Task 4: Verify and Stage

**Files:**

- Verify: task files and their tests.

- [ ] **Step 1: Run focused checks**

Run the two source-contract scripts, screenshot Playwright contract, `npm run lint`, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Stage only task files**

Stage the new plan, `e2e/screenshotData.spec.ts`, `scripts/atMemberPopupBehavior.test.cts`, `scripts/mergeForwardDetail.test.cts`, and the three modified components. Keep unrelated native-download changes unstaged and do not commit.
