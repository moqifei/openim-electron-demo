# Chat @, Screenshot, and Merge Forward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the group @ picker deterministic and dismissible, restore the optional screenshot hide-window behavior without foregrounding a background client, and make merge-forwarded records copyable and based on the user's exact selection.

**Architecture:** Keep the @ popup state in `ChatFooter`, with `AtMemberPopup` responsible only for filtering and one keyboard handler. Restore the existing local preference through the current renderer-to-main screenshot IPC boundary, where the main process owns all window visibility changes. Freeze merge-forward message data before target selection and reuse the existing image clipboard helper in the merge-detail view.

**Tech Stack:** React 18, TypeScript, Ant Design, Zustand, Electron IPC, OpenIM SDK, Playwright source-contract tests, Node `assert` scripts.

## Global Constraints

- Do not change OpenIM message protocol fields, server APIs, or screenshot capture backends.
- Do not alter the unrelated, already-uncommitted native-download changes in `electron/constants/index.ts`, `electron/main/ipcHandlerManage.ts`, `src/utils/fileDownload.ts`, `electron/main/nativeFileDownload.ts`, `e2e/nativeDownloadFallback.spec.ts`, or `scripts/nativeFileDownload.test.cjs`.
- Keep `screenshotHideWindow` in `localStorage`, defaulting to `true` only when unset.
- An unselected hide-window option, or an unfocused client, must never cause `show`, `restore`, or `focus`.
- Preserve the existing screenshot clipboard write, pending-attachment, native selection, and cropper paths.
- Tests must be changed or added before their production implementation and observed failing for the expected missing behavior.
- Do not create a Git commit unless the user separately approves commit authorization.

---

### Task 1: Make the @ Member Picker Single-Dispatch and Conversation-Scoped

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx:20-168`
- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx:121-132`, `456-597`, `901-922`
- Create: `scripts/atMemberPopupBehavior.test.cts`

**Interfaces:**

- Consumes: `AtMemberPopupProps` with `visible`, `members`, `onSelect`, and `onClose`.
- Produces: one keyboard event path from the popup's `Input`; `ChatFooter` closes the portal when a pointer target is outside it or `currentConversation?.conversationID` changes.

- [ ] **Step 1: Write the failing source-contract test**

Create `scripts/atMemberPopupBehavior.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const popup = read("src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx");
const footer = read("src/pages/chat/queryChat/ChatFooter/index.tsx");

assert.equal(
  (popup.match(/onKeyDown=\{handleKeyDown\}/g) ?? []).length,
  1,
  "the @ popup must handle each key once, from its focused search input",
);
assert.match(
  popup,
  /ref=\{popupRef\}[\s\S]*?document\.addEventListener\("pointerdown", handlePointerDown\)/,
  "clicking outside the popup must close it",
);
assert.match(
  footer,
  /useEffect\(\(\) => \{[\s\S]*?atPopupRequestIdRef\.current \+= 1;[\s\S]*?setAtPopupVisible\(false\);[\s\S]*?\}, \[currentConversation\?\.conversationID\]\)/,
  "switching conversations must close the popup and invalidate a pending member request",
);
assert.match(
  footer,
  /ref=\{atPopupPortalRef\}/,
  "the portal wrapper must be identifiable by the footer",
);

console.log("atMemberPopupBehavior tests passed");
```

- [ ] **Step 2: Run the test and verify it is red**

Run:

```powershell
npx tsx scripts/atMemberPopupBehavior.test.cts
```

Expected: failure stating that the @ popup must handle each key once, because the current input and popup container each bind `onKeyDown={handleKeyDown}`.

- [ ] **Step 3: Implement the minimum popup behavior**

In `AtMemberPopup/index.tsx`:

```tsx
const popupRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!visible) return;

  const handlePointerDown = (event: PointerEvent) => {
    if (!popupRef.current?.contains(event.target as Node)) onClose();
  };
  document.addEventListener("pointerdown", handlePointerDown);
  return () => document.removeEventListener("pointerdown", handlePointerDown);
}, [onClose, visible]);

return (
  <div ref={popupRef} className={styles.popup}>
    <div className={styles.inputWrap}>
      <Input
        ref={inputRef}
        size="small"
        placeholder={t("placeholder.search")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={handleKeyDown}
        allowClear
      />
    </div>
    <div className={styles.list}>
      <div
        className={clsx(styles.item, activeIndex === 0 && styles.active)}
        onClick={handleSelectAll}
        onMouseEnter={() => setActiveIndex(0)}
      >
        <span className={styles.atLabel}>@</span>
        <span className={styles.allTag}>{t("placeholder.mentionAll")}</span>
      </div>
      {filtered.map((member, index) => {
        const itemIndex = index + 1;
        return (
          <div
            key={member.userID}
            className={clsx(styles.item, activeIndex === itemIndex && styles.active)}
            onClick={() => handleSelect(member)}
            onMouseEnter={() => setActiveIndex(itemIndex)}
          >
            <OIMAvatar size={28} src={member.faceURL} text={member.nickname} />
            <span className={styles.name}>{member.nickname}</span>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className={styles.empty}>{t("empty.noSearchResults")}</div>
      )}
    </div>
  </div>
);
```

Remove `onKeyDown={handleKeyDown}` from the outer `.popup` element. Do not change the modulo navigation logic: with `@everyone` at index `0`, `filtered.length + 1` remains the correct row count.

In `ChatFooter/index.tsx`, add a `useRef<HTMLDivElement>(null)` named `atPopupPortalRef`. Add an effect keyed by `currentConversation?.conversationID` that increments `atPopupRequestIdRef.current`, resets `atPopupLoadingRef.current`, clears `groupMemberList`, clears `atTriggerNeedsRemovalRef.current`, and closes the popup. Attach the ref to the portal wrapper. Keep `handleAtClose` as the user-initiated close function so Escape returns focus to the editor.

- [ ] **Step 4: Run the focused test and existing Escape contract**

Run:

```powershell
npx tsx scripts/atMemberPopupBehavior.test.cts
npx tsx scripts/downloadPathAndAtEscape.test.cts
```

Expected: both pass; the latter continues to prove Escape invalidates a pending request and resets its trigger state.

- [ ] **Step 5: Check the focused diff**

Run:

```powershell
git diff --check -- src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx src/pages/chat/queryChat/ChatFooter/index.tsx scripts/atMemberPopupBehavior.test.cts
```

Expected: no whitespace errors and no changes outside the @ picker behavior.

### Task 2: Restore the Screenshot Hide-Window Preference and Guard Foregrounding

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx:1-6`, `71-100`, `267-288`
- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx:375-410`
- Modify: `electron/preload/index.ts:147-152`
- Modify: `src/types/globalExpose.d.ts:35-38`
- Modify: `electron/main/ipcHandlerManage.ts:682-908`
- Modify: `e2e/screenshotData.spec.ts:59-76`
- Modify: `scripts/screenshotSilentBehavior.test.cts:15-30`

**Interfaces:**

- Consumes: `localStorage.getItem("screenshotHideWindow")` and `SendActionBar`'s screenshot callback.
- Produces: `startScreenshot(hideWindow: boolean): Promise<{ dataUrl: string; isSelection: boolean } | null>` exposed on `window.electronAPI`.
- Invariant: `hiddenForCapture` is true only for an enabled preference and a currently focused, visible, non-destroyed window.

- [ ] **Step 1: Change screenshot contracts into failing tests**

Replace the removed-setting test in `e2e/screenshotData.spec.ts` with:

```ts
test("restores the screenshot hide-window preference through the UI and footer", () => {
  const footerSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/index.tsx",
    "utf8",
  );
  const actionBarSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
    "utf8",
  );

  expect(actionBarSource).toContain("screenshotHideWindow");
  expect(actionBarSource).toContain("localStorage.setItem");
  expect(footerSource).toContain("screenshotHideWindow");
  expect(footerSource).toContain("startScreenshot(hideWindow)");
});
```

Replace the no-hide assertions in `scripts/screenshotSilentBehavior.test.cts` with:

```ts
assert.match(
  ipcSource,
  /IpcRenderToMain\.startScreenshot, async \(_, hideWindow: boolean = true\) =>/,
);
assert.match(
  ipcSource,
  /const hiddenForCapture = Boolean\([\s\S]*?hideWindow[\s\S]*?win[\s\S]*?win\.isVisible\(\)[\s\S]*?!win\.isDestroyed\(\)/,
);
assert.match(ipcSource, /if \(hiddenForCapture\) \{[\s\S]*?win\.hide\(\)/);
assert.match(
  ipcSource,
  /if \(hiddenForCapture\) \{[\s\S]*?win\.show\(\);[\s\S]*?win\.focus\(\);/,
);
assert.match(preloadSource, /const startScreenshot = \(hideWindow: boolean\): Promise/);
assert.match(typeSource, /startScreenshot: \(hideWindow: boolean\) =>/);
assert.match(
  footerSource,
  /const hideWindow = localStorage\.getItem\("screenshotHideWindow"\) !== "false";/,
);
assert.match(actionBarSource, /screenshotHideWindow/);
```

Retain the existing assertions that `triggerScreenshot` itself does not call `show`, `restore`, or `focus`, and that an absent focused window chooses the cursor display rather than throwing.

- [ ] **Step 2: Run the changed contracts and verify they are red**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
npx tsx scripts/screenshotSilentBehavior.test.cts
```

Expected: both fail because the current implementation deliberately removed `screenshotHideWindow`, exposes a zero-argument screenshot bridge, and has no `hiddenForCapture` guard.

- [ ] **Step 3: Restore the renderer preference and typed IPC argument**

In `SendActionBar/index.tsx`, import `Checkbox`, initialize and update the preference with these exact semantics:

```tsx
const [hideWindowConfig, setHideWindowConfig] = useState(
  () => localStorage.getItem("screenshotHideWindow") !== "false",
);

const handleScreenshotClick = () => onScreenshot(hideWindowConfig);

const toggleHideWindow = (checked: boolean) => {
  setHideWindowConfig(checked);
  localStorage.setItem("screenshotHideWindow", String(checked));
};
```

Render the existing screenshot icon with a click target and a compact `Popover` containing:

```tsx
<Checkbox
  checked={hideWindowConfig}
  onChange={(event) => toggleHideWindow(event.target.checked)}
>
  {t("placeholder.screenshotHideWindow")}
</Checkbox>
```

Update its prop type to `onScreenshot: (hideWindow: boolean) => void`. In `ChatFooter/index.tsx`, update `startScreenshot` to accept `hideWindow`, pass it to `window.electronAPI.startScreenshot(hideWindow)`, and read the same preference inside the global `triggerScreenshot` subscription before invoking it.

Restore the matching bridge in `electron/preload/index.ts` and `src/types/globalExpose.d.ts`:

```ts
const startScreenshot = (
  hideWindow: boolean,
): Promise<{
  dataUrl: string;
  isSelection: boolean;
} | null> => ipcRenderer.invoke(IpcRenderToMain.startScreenshot, hideWindow);
```

- [ ] **Step 4: Implement conditional main-window hiding and restoration**

At the `startScreenshot` IPC handler in `electron/main/ipcHandlerManage.ts`, use the focused window only as the optional capture source and visibility owner:

```ts
ipcMain.handle(
  IpcRenderToMain.startScreenshot,
  async (_, hideWindow: boolean = true) => {
    const win = BrowserWindow.getFocusedWindow();
    const hiddenForCapture = Boolean(
      hideWindow && win && !win.isDestroyed() && win.isVisible(),
    );
    const display = win
      ? screen.getDisplayMatching(win.getBounds())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) ||
        screen.getPrimaryDisplay();

    if (hiddenForCapture) {
      win.hide();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    try {
      // Keep the current code from `const selectedDataUrl = await new Promise...`
      // through the final thumbnail fallback return inside this try block unchanged.
    } finally {
      if (hiddenForCapture && win && !win.isDestroyed()) {
        win.show();
        win.focus();
      }
    }
  },
);
```

Do not call `show`, `restore`, or `focus` outside the `hiddenForCapture` branch. Do not alter `windowManage.ts`; the global shortcut must continue to dispatch without foregrounding the client.

- [ ] **Step 5: Run the restored contracts**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
npx tsx scripts/screenshotSilentBehavior.test.cts
npx tsx scripts/screenshotShortcut.test.cts
```

Expected: all pass; the setting is present, the bridge carries the boolean, and only enabled foreground captures can hide and later restore the window.

### Task 3: Freeze Merge-Forward Selection and Enable Text/Image Copy in Detail Records

**Files:**

- Modify: `src/pages/chat/queryChat/ChatContent.tsx:311-420`
- Modify: `src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx:1-15`, `123-150`, `240-246`
- Create: `scripts/mergeForwardDetail.test.cts`

**Interfaces:**

- Consumes: the current `MessageItemType[]` selection, `IMSDK.createMergerMessage`, `copyImageToClipboard`, and `feedbackToast`.
- Produces: a JSON-deep-cloned `MessageItemType[]` captured before `ForwardModal.openModal`, and merge detail text/image rows that are individually copyable.

- [ ] **Step 1: Write the failing source-contract test**

Create `scripts/mergeForwardDetail.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const chatContent = read("src/pages/chat/queryChat/ChatContent.tsx");
const mergeDetail = read(
  "src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx",
);

assert.match(
  chatContent,
  /const mergeMessages = JSON\.parse\(JSON\.stringify\(messages\)\) as MessageItemType\[\];/,
  "merge forwarding must freeze the selected message payload before target selection",
);
assert.match(
  chatContent,
  /messageList: mergeMessages/,
  "the SDK must receive the frozen selection rather than live message objects",
);
assert.match(
  mergeDetail,
  /import \{ copyImageToClipboard \} from "@\/utils\/imageClipboard";/,
  "merge detail images must use the existing native image clipboard helper",
);
assert.match(
  mergeDetail,
  /select-text/,
  "merge detail text must opt out of the application's global user-select:none rule",
);
assert.doesNotMatch(
  mergeDetail,
  /dangerouslySetInnerHTML/,
  "merge detail text must render as plain text so copied text is not generated HTML",
);
assert.match(
  mergeDetail,
  /copyImageToClipboard\(orig\)/,
  "copying a merge detail image must use its source image URL",
);

console.log("mergeForwardDetail tests passed");
```

- [ ] **Step 2: Run the test and verify it is red**

Run:

```powershell
npx tsx scripts/mergeForwardDetail.test.cts
```

Expected: it fails on the absent deep selection snapshot, absent merge-detail image clipboard import, and absent `select-text` class.

- [ ] **Step 3: Freeze the merge input before the forwarding modal opens**

At the top of `handleForward` in `ChatContent.tsx`, immediately after the empty-list guard, add:

```ts
const mergeMessages = isMerge
  ? (JSON.parse(JSON.stringify(messages)) as MessageItemType[])
  : messages;
```

Within the `isMerge && mergeMessages.length > 1` branch, replace every merge-specific use of `messages` with `mergeMessages`, including `slice(0, 2)` and the SDK input:

```ts
const { data: mergeMsg } = await IMSDK.createMergerMessage({
  messageList: mergeMessages,
  title,
  summaryList,
});
```

Keep ordinary one-by-one forwarding on its original `messages` list. In development builds only, compare the frozen client-message IDs with `mergeMsg.mergeElem?.multiMessage` when the SDK response populates it; log a boolean/count result only, not message contents, URLs, or identifiers.

- [ ] **Step 4: Make merge detail rows copyable without changing preview behavior**

In `MergeMessageDetailModal.tsx`:

```tsx
import { CopyOutlined } from "@ant-design/icons";
import { Image, Modal, Tooltip } from "antd";

import { feedbackToast } from "@/utils/common";
import { copyImageToClipboard } from "@/utils/imageClipboard";
```

Replace the text-message `dangerouslySetInnerHTML` element with:

```tsx
<div
  className={clsx(
    messageBubble,
    messageBubbleOthers,
    styles.bubble,
    "select-text whitespace-pre-wrap",
  )}
>
  {message.textElem?.content || ""}
</div>
```

For a picture row, preserve the existing `<Image src={src} preview={{ src: orig }} />` but wrap it in a `group relative` container and add a hover-only icon button:

```tsx
<Tooltip title={t("placeholder.copy")}>
  <button
    type="button"
    className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
    onClick={async (event) => {
      event.stopPropagation();
      try {
        await copyImageToClipboard(orig);
        feedbackToast({ msg: t("toast.copySuccess") });
      } catch {
        feedbackToast({ msg: t("toast.copyFailed") });
      }
    }}
  >
    <CopyOutlined />
  </button>
</Tooltip>
```

Keep the current fallback image, source/snapshot URL precedence, image preview source, file download behavior, and quote rendering unchanged.

- [ ] **Step 5: Run merge-detail and existing image-copy contracts**

Run:

```powershell
npx tsx scripts/mergeForwardDetail.test.cts
npx tsx scripts/imageMessageCopy.test.cts
npx playwright test e2e/downloadFileName.spec.ts
```

Expected: all pass; merge messages use frozen data, detail text can be selected, and merge-detail image copying reaches the same clipboard helper as ordinary image messages.

### Task 4: Run Integrated Verification and Manually Exercise the Three Workflows

**Files:**

- Verify only: the files changed in Tasks 1-3 plus their test files.

**Interfaces:**

- Consumes: all test contracts and the production Electron/Vite build.
- Produces: evidence that the three targeted workflows compile and retain their existing screenshot, clipboard, and message-list integrations.

- [ ] **Step 1: Run all targeted automated tests together**

Run:

```powershell
npx tsx scripts/atMemberPopupBehavior.test.cts
npx tsx scripts/downloadPathAndAtEscape.test.cts
npx tsx scripts/screenshotSilentBehavior.test.cts
npx tsx scripts/screenshotShortcut.test.cts
npx tsx scripts/mergeForwardDetail.test.cts
npx tsx scripts/imageMessageCopy.test.cts
npx playwright test e2e/screenshotData.spec.ts e2e/downloadFileName.spec.ts
```

Expected: every targeted script prints its success message and both Playwright files pass.

- [ ] **Step 2: Run static quality and production build checks**

Run:

```powershell
npm run lint
npm run build
```

Expected: ESLint completes without errors and Vite emits the renderer and Electron build output without TypeScript errors.

- [ ] **Step 3: Perform the focused desktop smoke test**

Run the desktop client and validate the following exact flows:

1. In a group chat, type `@`, then press Down and Up repeatedly. Each press moves one row. Click outside the popup, press Escape, and change the selected conversation while its member request is pending; the popup stays closed.
2. With “隐藏当前窗口截图” checked, trigger a foreground screenshot and verify the client is absent from the captured image and returns afterward. Uncheck it, trigger from a visible client, then trigger the global shortcut while the client is backgrounded; neither case foregrounds the client.
3. Select text and images in a chat, merge-forward them, and open the received record. Confirm that the message order/content matches the original selection, text can be mouse-selected and copied, and the image hover copy icon yields a pasteable image in an external editor.

- [ ] **Step 4: Inspect the final scoped diff**

Run:

```powershell
git diff --check
git status --short
git diff -- src/pages/chat/queryChat/ChatFooter/AtMemberPopup/index.tsx src/pages/chat/queryChat/ChatFooter/index.tsx src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx electron/preload/index.ts src/types/globalExpose.d.ts electron/main/ipcHandlerManage.ts src/pages/chat/queryChat/ChatContent.tsx src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx e2e/screenshotData.spec.ts scripts/screenshotSilentBehavior.test.cts scripts/atMemberPopupBehavior.test.cts scripts/mergeForwardDetail.test.cts
```

Expected: no whitespace errors; only the explicitly listed product/test files and the approved documentation are changed by this work, while pre-existing native-download changes remain untouched.

- [ ] **Step 5: Request commit approval only after successful verification**

Report the verification outputs and the exact list of implementation files. Do not stage or commit any file until the user explicitly authorizes a commit.
