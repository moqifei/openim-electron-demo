# Download Cancellation and Forward Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users cancel active file downloads and make all forwarding flows open directly into a unified person, group, and agent search.

**Architecture:** Preserve the existing `downloadFileWithProgress` promise API and add an optional `AbortSignal` so current callers remain compatible. Link native fallback requests to a main-process `AbortController` by request ID. Keep the normal target chooser unchanged and render a dedicated, forward-only direct-search left pane when `ForwardModal` opts into it.

**Tech Stack:** React 18, TypeScript, Ant Design, Electron IPC, Node `http`/`https` streams, Playwright, and existing Node/TS source-contract tests.

## Global Constraints

- Do not alter message-history searching or create the right-side history panel.
- Do not alter upload cancellation, destination choice, completed-file caching, or non-forward chooser workflows.
- Preserve current XHR-first downloading; invoke native fallback only for non-cancellation transport failures.
- Treat user cancellation as a terminal, non-error state with no failed-download toast.
- Native cancellation may remove only `${targetPath}.${requestId}.part`; it must never remove a completed target file.
- Preserve selected `CheckListItem` values and existing forward confirmation/send behavior.
- Do not stage or overwrite unrelated existing workspace changes.

---

## File Structure

| File                                                                                            | Responsibility                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `electron/main/nativeFileDownload.ts`                                                           | Make the streaming native helper react to an abort signal and clean up its partial file.                          |
| `electron/main/ipcHandlerManage.ts`                                                             | Own native download abort controllers, register the cancel IPC handler, and preserve progress/result IPC.         |
| `electron/constants/index.ts`                                                                   | Name the narrow renderer-to-main native-cancellation channel, which uses the existing generic `ipcInvoke` bridge. |
| `src/utils/fileTransferProgress.tsx`                                                            | Render an active download close action as an explicit cancel action.                                              |
| `src/utils/fileDownload.ts`                                                                     | Bind an optional renderer abort signal to XHR/native fallback and export cancellation classification.             |
| `src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx`                                    | Own the active `AbortController` and provide an in-card cancel control.                                           |
| `src/pages/common/ChooseModal/ChooseBox/ForwardSearchList.tsx`                                  | Search and display selectable people, groups, and agents only for forwarding.                                     |
| `src/pages/common/ChooseModal/ChooseBox/index.tsx`                                              | Select the forward-search pane only when a caller requests it.                                                    |
| `src/pages/chat/queryChat/ForwardModal.tsx`                                                     | Enable forward-search mode and preserve confirmation/reset behavior.                                              |
| `scripts/downloadCancellationBehavior.test.cts`, `scripts/forwardDirectSearchBehavior.test.cts` | Source-contract checks for the new behavior.                                                                      |
| `scripts/nativeFileDownload.test.cjs`, `e2e/nativeDownloadFallback.spec.ts`                     | Native cancellation runtime test and IPC/static contract extension.                                               |

## Task 1: Add Abortable Native Download and IPC Contract

**Files:**

- Modify: `electron/main/nativeFileDownload.ts`
- Modify: `electron/main/ipcHandlerManage.ts`
- Modify: `electron/constants/index.ts`
- Modify: `scripts/nativeFileDownload.test.cjs`
- Modify: `e2e/nativeDownloadFallback.spec.ts`

**Interfaces:**

- Consumes: Existing `downloadFileNative(options)` and `IpcRenderToMain.downloadFileNative` request payload.
- Produces: `downloadFileNative({ ..., signal?: AbortSignal })`, native error code `ERR_DOWNLOAD_CANCELLED`, and `IpcRenderToMain.cancelDownloadFileNative` accepting `{ requestId: string }` and returning `boolean`.

- [ ] **Step 1: Write the failing native abort test**

Extend `scripts/nativeFileDownload.test.cjs` with a slow endpoint that writes one chunk, holds the connection open, and asserts the helper rejects after `controller.abort()`:

```js
const controller = new AbortController();
const cancelledPath = path.join(tempDir, "cancelled.bin");
const pending = downloadFileNative({
  url: `http://127.0.0.1:${port}/slow`,
  targetPath: cancelledPath,
  requestId: "cancelled",
  signal: controller.signal,
  logger,
});
setTimeout(() => controller.abort(), 10);

await assert.rejects(pending, (error) => error.code === "ERR_DOWNLOAD_CANCELLED");
assert.equal(fs.existsSync(cancelledPath), false);
assert.equal(fs.existsSync(`${cancelledPath}.cancelled.part`), false);
```

Extend `e2e/nativeDownloadFallback.spec.ts` to require the cancellation channel, controller map, signal wiring, and `ERR_DOWNLOAD_CANCELLED` literal.

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/nativeFileDownload.test.cjs
npx playwright test e2e/nativeDownloadFallback.spec.ts --workers=1
```

Expected: the runtime test fails because `NativeFileDownloadOptions` does not accept or observe `signal`; the source contract fails because the cancellation IPC does not exist.

- [ ] **Step 3: Make the native helper abortable**

Add `signal?: AbortSignal` to `NativeFileDownloadOptions`. Thread it through `requestResponse` and `streamResponseToFile`. Use one cancellation error factory:

```ts
const createDownloadCancelledError = () =>
  createDownloadError("Native download cancelled", { code: "ERR_DOWNLOAD_CANCELLED" });
```

For each outstanding HTTP request, register a one-time `signal` abort listener that calls `request.destroy(createDownloadCancelledError())`; remove the listener when that request settles. In `streamResponseToFile`, register the same listener to call the existing single-settlement failure path with the cancellation error. That path must destroy the response/output and unlink only `partialPath`. Remove its listener in both success and failure paths. Check `signal.aborted` before opening a request or write stream.

- [ ] **Step 4: Add the narrow main-process cancellation channel**

In `ipcHandlerManage.ts`, add one module-level map and two handlers:

```ts
const nativeDownloadAbortControllers = new Map<string, AbortController>();

ipcMain.handle(IpcRenderToMain.cancelDownloadFileNative, (_, { requestId }) => {
  const controller = nativeDownloadAbortControllers.get(requestId);
  if (!controller) return false;
  controller.abort();
  return true;
});
```

Create and register an `AbortController` immediately after `safeRequestId` is computed in the existing download handler. Pass `signal: controller.signal` to `downloadFileNative`, and delete that map entry in `finally` only if it still references the same controller. Add `cancelDownloadFileNative: "cancelDownloadFileNative"` to `IpcRenderToMain`; call it through the existing generic `window.electronAPI.ipcInvoke` bridge without changing that bridge's type surface.

- [ ] **Step 5: Run the native tests to green**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/nativeFileDownload.test.cjs
npx playwright test e2e/nativeDownloadFallback.spec.ts --workers=1
```

Expected: the slow native transfer rejects with `ERR_DOWNLOAD_CANCELLED`, no final or `.part` file remains, and both contract tests pass.

- [ ] **Step 6: Commit this self-contained task**

```powershell
git add -- electron/main/nativeFileDownload.ts electron/main/ipcHandlerManage.ts electron/constants/index.ts scripts/nativeFileDownload.test.cjs e2e/nativeDownloadFallback.spec.ts
git commit -m "feat: cancel native file downloads"
```

## Task 2: Cancel Renderer Downloads From Notification and File Card

**Files:**

- Modify: `src/utils/fileTransferProgress.tsx`
- Modify: `src/utils/fileDownload.ts`
- Modify: `src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx`
- Create: `scripts/downloadCancellationBehavior.test.cts`
- Modify: `e2e/fileDownloadDiagnostics.spec.ts`

**Interfaces:**

- Consumes: `IpcRenderToMain.cancelDownloadFileNative` and Task 1's `ERR_DOWNLOAD_CANCELLED` code.
- Produces: `DownloadFileOptions.signal?: AbortSignal`, `isDownloadCancelledError(error): boolean`, and `showFileTransferProgress({ ..., onCancel?: () => void })`.

- [ ] **Step 1: Write the failing renderer cancellation contract test**

Create `scripts/downloadCancellationBehavior.test.cts` to read the three source files and assert:

```ts
assert.match(fileDownload, /signal\?: AbortSignal/);
assert.match(fileDownload, /xhr\.abort\(\)/);
assert.match(fileDownload, /cancelDownloadFileNative/);
assert.match(fileDownload, /isDownloadCancelledError/);
assert.match(progress, /onCancel\?: \(\) => void/);
assert.match(progress, /closeIcon/);
assert.match(fileMessage, /AbortController/);
assert.match(fileMessage, /onCancel: cancelDownload/);
assert.match(fileMessage, /isDownloadCancelledError/);
```

Add an `e2e/fileDownloadDiagnostics.spec.ts` assertion that cancellation errors preserve `ERR_DOWNLOAD_CANCELLED` when passed to `getDownloadErrorDiagnostics`.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/downloadCancellationBehavior.test.cts
npx playwright test e2e/fileDownloadDiagnostics.spec.ts --workers=1
```

Expected: the new source assertions fail because no renderer cancellation contract or in-card cancel control exists.

- [ ] **Step 3: Add signal-aware transfer settlement**

Extend the existing option type without changing existing callers:

```ts
type DownloadFileOptions = {
  // existing fields
  signal?: AbortSignal;
};

export const isDownloadCancelledError = (error: unknown) =>
  (error as { code?: string })?.code === "ERR_DOWNLOAD_CANCELLED";
```

Inside `downloadFileWithProgress`, use a single `settled` guard and an error created with `code: "ERR_DOWNLOAD_CANCELLED"`. Register the passed signal before `xhr.send()`. If cancellation occurs before native fallback, call `xhr.abort()` and reject once with that error. If fallback is active, invoke `cancelDownloadFileNative` with its `requestId`, unsubscribe from progress, and reject once with the same cancellation error. Make `xhr.onabort` recognize the user-cancelled flag and bypass `failDownload`; make `downloadWithNativeFallback` return immediately for a cancellation error or an already-aborted signal.

Pass `onCancel` to `showFileTransferProgress` only while active; its callback aborts the same signal. Update `fileTransferProgress.tsx` so `onCancel` supplies an accessible close icon that calls `onCancel()` and destroys the keyed notification. Do not attach `onCancel` to success/exception notifications, whose close behavior stays ordinary.

- [ ] **Step 4: Add the file-card cancel action**

In `FileMessageRender.tsx`, use `useRef<AbortController | null>(null)`. Create and retain a controller immediately before calling `downloadFileWithProgress`, pass `signal: controller.signal`, and clear the ref only if it still points to that controller. Add:

```ts
const cancelDownload = useCallback(() => {
  downloadAbortControllerRef.current?.abort();
}, []);
```

During `isDownloading`, render an accessible text action labeled with the existing cancellation translation if present, otherwise the literal `"取消"`, next to the progress bar. In the catch block return silently when `isDownloadCancelledError(error)` is true; leave the current transfer-error feedback unchanged for real failures.

- [ ] **Step 5: Run renderer tests to green**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/downloadCancellationBehavior.test.cts
npx playwright test e2e/fileDownloadDiagnostics.spec.ts e2e/downloadFileName.spec.ts --workers=1
npx tsc --noEmit
```

Expected: cancellation is classified without a failure toast, the notification and file card reach the same abort path, and download filename/path behavior remains green.

- [ ] **Step 6: Commit this self-contained task**

```powershell
git add -- src/utils/fileTransferProgress.tsx src/utils/fileDownload.ts src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx scripts/downloadCancellationBehavior.test.cts e2e/fileDownloadDiagnostics.spec.ts
git commit -m "feat: cancel active file downloads"
```

## Task 3: Add Forward-Only Unified Target Search

**Files:**

- Create: `src/pages/common/ChooseModal/ChooseBox/ForwardSearchList.tsx`
- Modify: `src/pages/common/ChooseModal/ChooseBox/index.tsx`
- Modify: `src/pages/chat/queryChat/ForwardModal.tsx`
- Create: `scripts/forwardDirectSearchBehavior.test.cts`

**Interfaces:**

- Consumes: `CheckListItem`, `searchADMembers`, `searchAgents`, `useContactStore.getState().groupList`, `filterByFuzzyPinyin`, and the chooser's existing `checkClick`/`isChecked` callbacks.
- Produces: `ChooseBox` prop `forwardSearch?: boolean` and a focused `ForwardSearchList` that reports existing `CheckListItem` targets through those callbacks.

- [ ] **Step 1: Write the failing forward-search contract test**

Create `scripts/forwardDirectSearchBehavior.test.cts` that checks the new isolated component and wiring:

```ts
assert.match(chooseBox, /forwardSearch\?: boolean/);
assert.match(chooseBox, /<ForwardSearchList/);
assert.match(forwardModal, /forwardSearch/);
assert.match(forwardSearchList, /inputRef\.current\?\.focus/);
assert.match(forwardSearchList, /searchADMembers/);
assert.match(forwardSearchList, /searchAgents/);
assert.match(forwardSearchList, /groupList/);
assert.match(forwardSearchList, /itemClick=\{checkClick\}/);
assert.match(chooseBox, /!forwardSearch[\s\S]*menuList\.map/);
```

The final assertion protects the current category-first chooser when `forwardSearch` is not requested.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/forwardDirectSearchBehavior.test.cts
```

Expected: it fails because `ForwardSearchList` and the `forwardSearch` opt-in do not exist.

- [ ] **Step 3: Implement the isolated forward search pane**

Create `ForwardSearchList.tsx` with this prop boundary:

```ts
type ForwardSearchListProps = {
  checkClick: (item: CheckListItem) => void;
  isChecked: (item: CheckListItem) => boolean;
};
```

On mount, focus an Ant Design `Input` via `useRef<InputRef>(null)` and `requestAnimationFrame`. Debounce a non-empty keyword by 300 ms. In each search generation, run the existing people, agent, and local group lookups in parallel; ignore stale completions with a monotonically increasing request counter. Map all results into `CheckListItem`, de-duplicate by `userID`/`groupID`, label group and agent rows using existing `CheckItem` fields, and display the existing empty/loading components. Render each result through:

```tsx
<CheckItem
  showCheck
  isChecked={isChecked(item)}
  data={item}
  key={item.userID || item.groupID}
  itemClick={checkClick}
/>
```

Do not fetch all people, agents, or groups for an empty query. The focused empty search state is allowed to show the standard empty prompt.

- [ ] **Step 4: Wire the opt-in without changing ordinary chooser behavior**

Add `forwardSearch?: boolean` to `IChooseBoxProps`; pass it from `ChooseBox` to `CommonLeft`. In `CommonLeft`, return `<ForwardSearchList ... />` before rendering the current breadcrumb/menu branch only when `forwardSearch` is true. Do not change `menuList`, `menuClick`, group-member mode, or chooser selection semantics.

In `ForwardModal.tsx`, render:

```tsx
<ChooseBox className="!h-[60vh]" forwardSearch ref={chooseBoxRef} />
```

Leave `handleConfirm`, `handleCancel`, `closeModal`, and existing callback types intact so both one-by-one and merged forwarding continue calling `ChatContent` with the same selected targets.

- [ ] **Step 5: Run forward tests to green**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/forwardDirectSearchBehavior.test.cts
node --require ts-node/register/transpile-only scripts/mergeForwardDetail.test.cts
node --require ts-node/register/transpile-only scripts/atMemberPinyin.test.cts
npx tsc --noEmit
```

Expected: direct search is wired only into forwarding, merge forwarding still preserves its existing target/send path, and the generic chooser's current behavior remains covered.

- [ ] **Step 6: Commit this self-contained task**

```powershell
git add -- src/pages/common/ChooseModal/ChooseBox/ForwardSearchList.tsx src/pages/common/ChooseModal/ChooseBox/index.tsx src/pages/chat/queryChat/ForwardModal.tsx scripts/forwardDirectSearchBehavior.test.cts
git commit -m "feat: search forward targets directly"
```

## Task 4: Integrate and Verify the Approved Scope

**Files:**

- Verify: all Task 1-3 files and their tests.

**Interfaces:**

- Consumes: completed cancellation and forward-search contracts.
- Produces: an evidence-backed final change set without history-panel work.

- [ ] **Step 1: Run targeted regression tests**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/nativeFileDownload.test.cjs
node --require ts-node/register/transpile-only scripts/downloadCancellationBehavior.test.cts
node --require ts-node/register/transpile-only scripts/forwardDirectSearchBehavior.test.cts
node --require ts-node/register/transpile-only scripts/mergeForwardDetail.test.cts
npx playwright test e2e/nativeDownloadFallback.spec.ts e2e/fileDownloadDiagnostics.spec.ts --workers=1
npx tsc --noEmit
```

Expected: all commands succeed with no cancellation treated as a failed transfer.

- [ ] **Step 2: Inspect the scoped diff and working tree**

Run:

```powershell
git diff --check
git diff -- electron/main/nativeFileDownload.ts electron/main/ipcHandlerManage.ts electron/constants/index.ts src/utils/fileTransferProgress.tsx src/utils/fileDownload.ts src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx src/pages/common/ChooseModal/ChooseBox/ForwardSearchList.tsx src/pages/common/ChooseModal/ChooseBox/index.tsx src/pages/chat/queryChat/ForwardModal.tsx scripts/downloadCancellationBehavior.test.cts scripts/forwardDirectSearchBehavior.test.cts scripts/nativeFileDownload.test.cjs e2e/nativeDownloadFallback.spec.ts e2e/fileDownloadDiagnostics.spec.ts
git status --short
```

Expected: no whitespace errors; the diff contains only approved download cancellation and direct-forward-search changes plus their tests; unrelated existing changes remain untouched.

- [ ] **Step 3: Commit verified integration only if no unrelated changes are staged**

```powershell
git status --short
git diff --cached --name-only
```

Expected: staged files are limited to the approved task files. If any unrelated file is staged, unstage only that exact unrelated file with user approval before committing.
