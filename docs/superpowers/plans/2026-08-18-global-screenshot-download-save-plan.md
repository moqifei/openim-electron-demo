# 全局截图快捷键与统一文件下载保存实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为客户端增加全局 `Ctrl+Shift+X` 截图、系统剪贴板写入，并让所有普通文件下载统一使用可编辑类型的原生保存对话框。

**Architecture:** 保留现有主进程截图实现和渲染进程截图编辑/待发送链路。主进程长期注册快捷键并通知渲染进程复用截图入口；渲染进程把截图 data URL 交给主进程写入剪贴板。普通下载继续由渲染进程 XHR 负责进度，下载完成后把二进制、推断文件名和 MIME 类型交给主进程原生保存对话框；非 Electron 环境保留 anchor fallback。

**Tech Stack:** Electron 22、React 18、TypeScript、Playwright、Vite、electron-log、现有 `globalShortcut`/`dialog`/`clipboard` API。

## Global Constraints

- 不修改消息协议、服务器接口、现有上传接口、截图分辨率修复、权限提示或截图 fallback 策略。
- 所有普通下载统一处理，包括聊天文件、引用/合并消息文件、多选保存文件和图片下载。
- 截图编辑器的专用 PNG 保存动作继续独立存在，不改造成普通附件下载。
- 不提交 Git；每个任务只修改工作区并运行对应验证。
- 遵循 TDD：每项生产代码前先写测试并确认测试因缺少实现而失败。

---

### Task 1: 文件名推断和保存过滤器纯函数

**Files:**

- Create: `src/utils/downloadFileName.ts`
- Create: `e2e/downloadFileName.spec.ts`

**Interfaces:**

- Produces `inferDownloadFileName(options: { fileName?: string; contentDisposition?: string | null; url?: string; mimeType?: string }): string`.
- Produces `getDownloadFileExtension(fileName: string): string`.
- Produces `getDownloadFileFilters(fileName: string): Array<{ name: string; extensions: string[] }>` for the main-process save dialog.

- [ ] **Step 1: Write the failing tests**

Add tests covering the required precedence and filters:

```ts
import { test, expect } from "@playwright/test";
import {
  getDownloadFileExtension,
  getDownloadFileFilters,
  inferDownloadFileName,
} from "../src/utils/downloadFileName";

test("prefers a real message filename over response metadata", () => {
  expect(
    inferDownloadFileName({
      fileName: "原始文档.docx",
      contentDisposition: 'attachment; filename="server.doc"',
      url: "https://example.test/download/other.txt",
      mimeType: "text/plain",
    }),
  ).toBe("原始文档.docx");
});

test("decodes RFC 5987 content disposition filename", () => {
  expect(
    inferDownloadFileName({
      contentDisposition: "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.docx",
    }),
  ).toBe("测试.docx");
});

test("uses URL and MIME type before falling back to download", () => {
  expect(
    inferDownloadFileName({
      fileName: "download",
      url: "https://example.test/files/report",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  ).toBe("report.docx");
  expect(inferDownloadFileName({ fileName: "download" })).toBe("download");
});

test("returns the extension without a leading dot", () => {
  expect(getDownloadFileExtension("report.DOCX")).toBe("docx");
  expect(getDownloadFileExtension("download")).toBe("");
});

test("creates a default type filter and an editable all-files option", () => {
  expect(getDownloadFileFilters("report.docx")).toEqual([
    { name: "DOCX 文件 (*.docx)", extensions: ["docx"] },
    { name: "所有文件 (*.*)", extensions: ["*"] },
  ]);
});
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
```

Expected: FAIL because `src/utils/downloadFileName.ts` does not exist yet. Do not proceed if the failure is caused by a test syntax or import error unrelated to the missing implementation.

- [ ] **Step 3: Implement the minimal pure helpers**

Implement the following behavior in `src/utils/downloadFileName.ts`:

- Treat empty strings and the exact placeholder name `download` (case-insensitive) as missing.
- Parse `filename*` before `filename` from `Content-Disposition`, decoding percent-encoded UTF-8 names and stripping surrounding quotes.
- Extract the final URL path segment after removing query/hash and decode it safely.
- Map at least these MIME types: DOC→`doc`, DOCX→`docx`, plain text→`txt`, ZIP→`zip`, PNG→`png`, JPEG→`jpg`, PDF→`pdf`.
- Preserve a supplied filename that already has an extension.
- Generate `[specific-extension-filter, all-files-filter]` for a filename with an extension, and only the all-files filter when no extension exists.

- [ ] **Step 4: Run the tests and verify they pass**

Run the same command:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
```

Expected: all tests in the new file PASS.

---

### Task 2: Main-process native download save IPC

**Files:**

- Modify: `electron/constants/index.ts`
- Modify: `electron/main/ipcHandlerManage.ts`
- Modify: `electron/preload/index.ts`
- Modify: `src/types/globalExpose.d.ts`

**Interfaces:**

- Consumes `getDownloadFileFilters` from the Electron-neutral `src/utils/downloadFileName.ts`; `electron/main/ipcHandlerManage.ts` imports this pure module so renderer and main process share one filter implementation.
- Produces `saveDownloadedFile(params: { data: ArrayBuffer; fileName: string }): Promise<boolean>`.
- Returns `false` for user cancellation and `true` after the selected file has been written.

- [ ] **Step 1: Add an IPC contract test before production changes**

Extend `e2e/downloadFileName.spec.ts` with a source-level contract check that reads `electron/constants/index.ts` and `electron/preload/index.ts` and expects the new `saveDownloadedFile` channel and exposed method. Keep the check focused on the public names, not implementation formatting.

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
```

Expected: the new contract assertions FAIL because the channel and preload method are not present.

- [ ] **Step 3: Implement the native save IPC**

Add a `saveDownloadedFile` channel. In the main handler:

```ts
const safeName = path.basename(fileName) || "download";
const result = await showSaveDialog({
  defaultPath: path.join(app.getPath("downloads"), safeName),
  filters: getDownloadFileFilters(safeName),
});
if (result.canceled || !result.filePath) return false;
await fs.promises.writeFile(result.filePath, Buffer.from(data));
return true;
```

Use the existing main-window-bound save dialog wrapper and the shared filter helper imported from `../../src/utils/downloadFileName`. Add the typed preload bridge and `IElectronAPI` declaration. Do not expose raw filesystem operations beyond this purpose.

- [ ] **Step 4: Run the contract and TypeScript build checks**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
npm run build
```

Expected: contract assertions and build pass; the generated preload/main code contains the new bridge without TypeScript errors.

---

### Task 3: Route every ordinary download through the unified save path

**Files:**

- Modify: `src/utils/fileDownload.ts`
- Modify: `src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx`
- Modify: `src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx`
- Modify: `src/pages/chat/queryChat/MessageItem/QuoteMessageRender.tsx`
- Modify: `src/pages/chat/queryChat/MultiSelectToolbar.tsx`
- Modify: `src/pages/chat/queryChat/MessageItem/MediaMessageRender.tsx`
- Test: `e2e/downloadFileName.spec.ts`

**Interfaces:**

- `downloadFileWithProgress` continues accepting `url`, optional `fileName`, `knownSize`, progress callbacks and toast options.
- In Electron, it invokes `window.electronAPI.saveDownloadedFile` with the response `ArrayBuffer` and inferred filename.
- Outside Electron, it continues using the existing anchor fallback.

- [ ] **Step 1: Add failing download-path tests**

Add a source contract test asserting that `fileDownload.ts` reads `Content-Disposition`, calls `response.arrayBuffer()`, and invokes `saveDownloadedFile`, while the ordinary file call sites no longer contain `fileName: ... || "download"`. Add a test that `MediaMessageRender.tsx` imports and invokes `downloadFileWithProgress`.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
```

Expected: FAIL on the missing unified save-path assertions.

- [ ] **Step 3: Implement the minimum integration**

In `fileDownload.ts`:

1. Keep the original `fileName` option, but compute the final name in `xhr.onload` from the actual response headers, resolved URL and Blob MIME type using `inferDownloadFileName`.
2. Convert the Blob to `ArrayBuffer`.
3. When `window.electronAPI?.saveDownloadedFile` exists, await it and resolve normally for both save and cancel; reject only for actual save errors.
4. Keep the existing anchor fallback for non-Electron environments.
5. Update progress success only after the response is accepted for saving, preserving the current exception behavior for HTTP/network failures.

Update all ordinary file call sites to pass the real optional filename and remove explicit `download` fallbacks. Replace the image-specific anchor in `MediaMessageRender.tsx` with `downloadFileWithProgress`, preserving its generated image name and error logging.

- [ ] **Step 4: Run targeted tests and build**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts
npm run build
```

Expected: download-path tests pass and the application builds without type or JSX errors.

---

### Task 4: Global screenshot shortcut and clipboard IPC

**Files:**

- Modify: `electron/constants/index.ts`
- Modify: `electron/main/shortcutManage.ts`
- Modify: `electron/main/windowManage.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/main/ipcHandlerManage.ts`
- Modify: `electron/preload/index.ts`
- Modify: `src/types/globalExpose.d.ts`
- Test: `e2e/screenshotData.spec.ts`

**Interfaces:**

- Produces main-to-render event `triggerScreenshot`.
- Produces `writeClipboardImage(base64: string): Promise<void>`.
- Keeps `startScreenshot(hideWindow?: boolean)` return type unchanged.

- [ ] **Step 1: Add failing shortcut and clipboard contract tests**

Extend `e2e/screenshotData.spec.ts` with source checks that require:

- `CommandOrControl+Shift+X` in `shortcutManage.ts`;
- no `unregisterShortcuts()` call from the main-window `blur` handler;
- `writeClipboardImage` in the constants, preload bridge and global type declaration;
- `clipboard.writeImage` and `nativeImage.createFromDataURL` in the main handler.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
```

Expected: the new contract assertions FAIL because the shortcut/event/clipboard pieces are not implemented.

- [ ] **Step 3: Implement the main-process behavior**

1. Add `triggerScreenshot` to `IpcMainToRender` and `writeClipboardImage` to `IpcRenderToMain`.
2. Add `writeClipboardImage` handler using `nativeImage.createFromDataURL(base64)` and `clipboard.writeImage(image)`.
3. Add a `triggerScreenshot` helper in `windowManage.ts` that shows/focuses the main window and sends the event to its web contents.
4. Register `CommandOrControl+Shift+X` alongside F12 in `shortcutManage.ts`.
5. Register shortcuts when the main window is created, remove focus/blur registration churn, and unregister on `app` `will-quit`.

Do not duplicate the existing screenshot capture implementation or alter its returned structure.

- [ ] **Step 4: Run the contract tests and build**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
npm run build
```

Expected: the screenshot contract tests and build pass.

---

### Task 5: Connect screenshot events and final clipboard content in ChatFooter

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx`
- Modify: `e2e/screenshotData.spec.ts`

**Interfaces:**

- Consumes the `triggerScreenshot` main-process event through `window.electronAPI.subscribe`.
- Uses the existing `startScreenshot` callback and `ScreenshotCropper` component.
- Calls `window.electronAPI.writeClipboardImage` for the initial and confirmed PNG data URLs.

- [ ] **Step 1: Add failing renderer contract tests**

Extend `e2e/screenshotData.spec.ts` with source assertions that `ChatFooter/index.tsx` subscribes to `triggerScreenshot`, invokes `writeClipboardImage` after receiving screenshot data, and invokes it from the screenshot-confirm callback.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
```

Expected: the new renderer assertions FAIL before the component changes.

- [ ] **Step 3: Implement the renderer wiring**

1. Keep the existing `startScreenshot` callback as the single screenshot entry point.
2. After a non-null screenshot result, call `writeClipboardImage(result.dataUrl)` in a best-effort `try/catch`, then keep the existing selection/pending-file or cropper branch.
3. In `handleScreenshotConfirm`, call `writeClipboardImage(croppedBase64)` before/alongside `addPendingFiles` without blocking the pending-file update if clipboard writing fails.
4. Add an effect subscribing to `triggerScreenshot` that invokes `startScreenshot` with the persisted hide-window setting. Clean up using the unsubscribe function returned by `subscribe`.
5. Keep the existing button-triggered flow, loading state, error messages and cropper behavior unchanged.

- [ ] **Step 4: Run screenshot tests and build**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts
npm run build
```

Expected: screenshot data tests, new contract assertions and build pass.

---

### Task 6: Full regression and requirement verification

**Files:**

- Verify all changed files; do not modify unrelated files.

- [ ] **Step 1: Inspect the final diff and workspace**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only the approved design/plan documents, implementation files and focused tests appear; no `.git/index.lock` or generated temporary files are present.

- [ ] **Step 2: Run the focused regression tests**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts e2e/screenshotData.spec.ts
```

Expected: exit code `0` with no failed tests.

- [ ] **Step 3: Run project lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0` without new TypeScript, JSX, SCSS or ESLint errors.

- [ ] **Step 4: Run the complete Playwright suite**

Run:

```powershell
npx playwright test
```

Expected: the full suite exits `0`. If an existing environment-dependent test fails, report its exact failure separately instead of claiming the whole suite passes.

- [ ] **Step 5: Record manual checks that require a desktop session**

Verify, when a desktop session is available:

- `Ctrl+Shift+X` works while the client is focused, unfocused and minimized/hidden.
- Screenshot pixels paste into an external editor before and after crop/annotation confirmation.
- DOC/DOCX/TXT/ZIP/PDF/PNG downloads open a save dialog with the original default name/type and an editable type selector.
- Changing the name/type writes to the chosen path; canceling does not show a failure toast.

If the desktop session is unavailable, explicitly report these as unverified manual checks.
