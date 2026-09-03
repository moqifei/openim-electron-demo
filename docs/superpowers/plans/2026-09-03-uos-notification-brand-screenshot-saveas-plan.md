# UOS 托盘悬停提醒、Linux 品牌、截图与图片另存为实施计划（修订版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以当前 Windows 托盘悬停实现为基准，修复 UOS 托盘消息展示、Linux 桌面启动、截图后台行为和图片预览另存为。

**Architecture:** 保留 `messageReminderManage.ts` 中 Windows 已使用的短时即时提醒，并保留 `trayManage.ts` 中 Windows 已使用的托盘悬停面板作为 Windows/UOS 共用入口；新消息同时更新提醒状态、托盘闪烁、tooltip 和即时弹窗，鼠标进入/移动托盘图标时显示共用的多消息面板，移开后按现有计时器隐藏。Linux 用户可见名称和实际可执行文件为“年糕”，内部目录、desktop 文件、包标识和脚本路径使用 `stickycake`。截图继续复用现有 Electron 原生链路，但移除隐藏窗口参数和任何主窗口显示/聚焦动作；图片另存为复用已有原生保存 IPC。

**Tech Stack:** Electron、Electron Builder、React、TypeScript、Ant Design、Playwright、Node.js、POSIX shell。

## Global Constraints

- UOS 收到消息时必须保留 Windows 当前的几秒钟即时提醒，并同步更新未读状态、托盘闪烁和 tooltip。
- UOS 托盘悬停消息面板必须依赖 `mouse-enter`/`mouse-move`，并复用当前 Windows 的 HTML、样式、尺寸、位置、鼠标监控、点击和隐藏时序；只允许增加 UOS 必需的窗口兼容参数。
- 桌面显示名称为 `年糕`；Linux 实际可执行文件为 `年糕`；Linux 内部目录、desktop 文件名、脚本变量和安装路径使用 `stickycake`。
- Linux desktop 启动入口固定为 `/opt/stickycake/年糕 %U`，实际打包产物检查必须证明该文件存在且可执行。
- Windows 的现有产品名、NSIS 配置、安装向导、任务栏提醒和产物兼容行为保持不变。
- 不使用 `niangao` 作为 Linux 执行文件或内部标识；不新增 `OpenCorp-Base` Linux 执行路径。
- 截图接口统一为 `startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>`。
- 后台快捷键截图不得调用主窗口的 `show()`、`restore()` 或 `focus()`，不得改变主窗口原有状态。
- 图片“下载”继续使用默认下载目录；“另存为”经过 `chooseDownloadPath` 和主进程保存 IPC。
- 用户取消图片另存为不显示下载失败。
- 每项行为先写失败测试，运行确认失败，再写最小实现并运行相关测试。
- 保留工作区已有用户修改和未合并内容，只修改需求相关文件。

---

## 文件结构与责任边界

| 文件                                                          | 责任                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `electron/main/trayManage.ts`                                 | Windows/UOS 共用托盘悬停面板、鼠标边界和显示/隐藏时序       |
| `electron/main/messageReminderManage.ts`                      | 现有即时提醒兼容边界；不得成为 UOS 托盘悬停逻辑的第二套实现 |
| `electron/main/messageReminderState.ts`                       | 未读会话状态和共用面板 HTML                                 |
| `electron/main/ipcHandlerManage.ts`                           | 新消息提醒 IPC、截图 IPC、保存 IPC                          |
| `electron/main/windowManage.ts`                               | 全局截图事件转发和主窗口状态                                |
| `electron/preload/index.ts`                                   | no-argument screenshot API 和保存 API 暴露                  |
| `src/types/globalExpose.d.ts`                                 | Electron API 类型契约                                       |
| `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx` | 截图按钮和截图设置移除                                      |
| `src/pages/chat/queryChat/ChatFooter/index.tsx`               | 截图调用、剪贴板和待发送队列                                |
| `src/pages/chat/queryChat/ChatContent.tsx`                    | 图片预览下载/另存为工具栏                                   |
| `src/utils/downloadFileName.ts`                               | 下载文件名和 MIME 扩展名推断                                |
| `electron-builder.json5`                                      | Linux 产品名、执行文件和打包元数据                          |
| `scripts/linuxCreateDesktopShortcut.sh`                       | Linux desktop 文件和用户桌面快捷方式                        |
| `scripts/linuxRemoveDesktopShortcut.sh`                       | Linux 卸载清理                                              |
| `scripts/afterPackBundledGlibc.cjs`                           | bundled glibc 启动器和真实执行文件                          |
| `build-linux-deb.sh`                                          | 自定义 deb 构建路径和内部包标识                             |
| `scripts/*.test.cts` / `e2e/*.spec.ts`                        | 回归测试和产物契约测试                                      |

---

### Task 1: 统一 Windows/UOS 即时提醒与托盘悬停面板

**Files:**

- Modify: `electron/main/messageReminderManage.ts:1-280` to remove the Linux/UOS-specific immediate reminder appearance and retain the Windows behavior for every desktop platform
- Modify: `electron/main/trayManage.ts:90-380` only if a UOS Electron window compatibility guard is required after the shared path is verified
- Modify: `electron/main/ipcHandlerManage.ts:570-595` only if the incoming-message handler needs a narrow logging or validation adjustment; it must continue calling `showMessageReminder`
- Test: `scripts/trayHover.test.cts`
- Test: `scripts/messageReminderUos.test.cts`
- Test: `scripts/messageReminderState.test.cts`
- Test: `scripts/taskbarMessageAttention.test.cts`

**Interfaces:**

- Consumes: `notifyIncomingMessage`, `setTrayAttention`, `getReminderConversations`, `buildReminderPanelHtml`, `handleTrayHover`, `showTrayReminderPanel`, and existing `openim-tray://conversation/<id>` handling.
- Produces: `notifyIncomingMessage -> showMessageReminder` for the same 5-second immediate reminder on Windows and UOS, plus `mouse-enter`/`mouse-move -> handleTrayHover -> buildReminderPanelHtml` for the shared multi-message tray panel.

- [ ] **Step 1: Rewrite the failing tests to encode both Windows message-entry paths**

Extend `scripts/trayHover.test.cts` with:

```ts
assert.match(source, /appTray\.on\("mouse-enter"[\s\S]*?handleTrayHover\(position\)/);
assert.match(source, /appTray\.on\("mouse-move"[\s\S]*?handleTrayHover\(position\)/);
assert.ok(source.includes("showTrayReminderPanel"));
assert.ok(
  source.includes("buildReminderPanelHtml(app.getName(), trayAttentionConversations)"),
);
assert.ok(source.includes("startTrayPanelMouseMonitor"));
assert.ok(source.includes("scheduleHideTrayReminderPanel"));
assert.ok(source.includes("panel.showInactive()"));
```

Add these panel-contract assertions to the same test:

```ts
const stateSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/messageReminderState.ts"),
  "utf8",
);
assert.match(stateSource, /class="conversation"/);
assert.match(stateSource, /class="ignore-all"/);
assert.match(stateSource, /忽略全部/);
assert.match(stateSource, /border-bottom: 1px solid #edf0f5/);
```

Replace the old Linux-specific assertions in `scripts/messageReminderUos.test.cts` with:

```ts
const reminderSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/messageReminderManage.ts"),
  "utf8",
);
const ipcSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
const traySource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/trayManage.ts"),
  "utf8",
);

assert.match(reminderSource, /const REMINDER_TIMEOUT_MS = 5000/);
assert.ok(reminderSource.includes("window.showInactive()"));
assert.ok(reminderSource.includes("window.setBounds(getReminderBounds(), false)"));
assert.doesNotMatch(reminderSource, /isLinuxReminder|pageBackground|toastBackground/);
assert.ok(ipcSource.includes("IpcRenderToMain.notifyIncomingMessage"));
assert.ok(ipcSource.includes("showMessageReminder({"));
assert.ok(traySource.includes("handleTrayHover"));
assert.ok(traySource.includes("buildReminderPanelHtml"));
```

This test explicitly prevents the current Linux/UOS-only dark notification branch while preserving the immediate popup entry point. Keep the existing taskbar attention assertions unchanged.

- [ ] **Step 2: Run the tests and verify RED before changing production code**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/trayHover.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderState.test.cts
```

Expected before implementation: `messageReminderUos.test.cts` fails because the current implementation contains `isLinuxReminder`, `pageBackground` and `toastBackground`; the panel/state tests may pass. Do not weaken the test to make the current Linux-specific appearance pass.

- [ ] **Step 3: Implement the Windows-baseline immediate reminder**

1. In `electron/main/messageReminderManage.ts`, remove `isLinuxReminder` and the conditional `pageBackground`, `toastBackground`, `focusable`, `transparent`, `backgroundColor` and always-on-top level values. Keep one `BrowserWindow` configuration and one `buildReminderHtml` result for Windows and UOS, using the current Windows values: `REMINDER_WIDTH = 320`, `REMINDER_HEIGHT = 110`, transparent background, `focusable: true`, `alwaysOnTop: true`, `showInactive()`, and a 5-second timeout.
2. Keep `showMessageReminder(payload)` responsible for adding/updating the conversation in `messageReminderState.ts`, synchronizing tooltip and tray attention, loading the one-message HTML, resetting the existing timeout, and hiding the reminder after `REMINDER_TIMEOUT_MS`.
3. Keep `ipcHandlerManage.ts`'s valid-payload branch as the single incoming-message entry point:

```ts
showMessageReminder({
  conversationID: payload.conversationID,
  title: payload.title,
  body: payload.body,
});
```

Do not replace this call with only a state update and do not add a second UOS notification builder.

- [ ] **Step 4: Verify the shared tray-hover panel contract**

1. Keep `trayManage.ts`'s `mouse-enter`, `mouse-move`, `mouse-leave`, `handleTrayHover`, `showTrayReminderPanel`, work-area placement, mouse monitor, `showInactive`, click routing and delayed hide logic unchanged unless a test exposes a concrete UOS timing issue.
2. Confirm `buildReminderPanelHtml(app.getName(), trayAttentionConversations)` is the only panel renderer. Each `.conversation` item must remain a separate block with title and body; `.ignore-all` must be after all conversation items.
3. If UOS needs a window-manager compatibility setting, change only the existing `trayPanelWindow` properties and prove that the shared HTML, width, dynamic height, placement and mouse event flow remain unchanged. Do not create UOS-only CSS or a second panel window.
4. Keep `messageReminderState.ts` as the single source for conversation ordering, escaping and panel HTML.

- [ ] **Step 5: Run the tests and verify GREEN**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/trayHover.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderState.test.cts
node --require ts-node/register/transpile-only scripts/taskbarMessageAttention.test.cts
```

Expected: all four commands exit 0 and print their test-passed messages.

- [ ] **Step 6: Commit**

```powershell
git add -- electron/main/trayManage.ts electron/main/ipcHandlerManage.ts electron/main/messageReminderManage.ts scripts/trayHover.test.cts scripts/messageReminderUos.test.cts scripts/messageReminderState.test.cts scripts/taskbarMessageAttention.test.cts
git commit -m "fix: align UOS reminders with Windows"
```

---

### Task 2: 删除截图隐藏选项并保持后台快捷键静默

**Files:**

- Modify: `electron/main/windowManage.ts:145-160`
- Modify: `electron/main/ipcHandlerManage.ts:618-855`
- Modify: `electron/preload/index.ts:147-153`
- Modify: `src/types/globalExpose.d.ts:34-39`
- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx:74-225,290-325`
- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx:370-415,750-765`
- Test: create `scripts/screenshotSilentBehavior.test.cts`
- Test: `e2e/screenshotData.spec.ts`

**Interfaces:**

- Consumes: existing native screenshot/fallback capture, `IpcMainToRender.triggerScreenshot`, and clipboard writing.
- Produces: `triggerScreenshot(): void` without window manipulation and `startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>` with no parameter.

- [ ] **Step 1: Write failing tests**

Create `scripts/screenshotSilentBehavior.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const windowSource = read("electron/main/windowManage.ts");
const ipcSource = read("electron/main/ipcHandlerManage.ts");
const preloadSource = read("electron/preload/index.ts");
const typeSource = read("src/types/globalExpose.d.ts");
const footerSource = read("src/pages/chat/queryChat/ChatFooter/index.tsx");
const actionBarSource = read(
  "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
);

const triggerBody = windowSource
  .split("export const triggerScreenshot = () =>")[1]
  .split("// utils")[0];
assert.doesNotMatch(triggerBody, /\.show\(\)|\.restore\(\)|\.focus\(\)/);
assert.match(ipcSource, /IpcRenderToMain\.startScreenshot, async \(\)/);
assert.doesNotMatch(ipcSource, /hideWindow/);
assert.match(preloadSource, /const startScreenshot = \(\): Promise/);
assert.match(typeSource, /startScreenshot: \(\) =>/);
assert.doesNotMatch(footerSource, /screenshotHideWindow/);
assert.doesNotMatch(actionBarSource, /screenshotHideWindow|截图时隐藏窗口/);
assert.match(footerSource, /startScreenshot\(\)/);
assert.ok(footerSource.includes("writeClipboardImage"));
assert.ok(footerSource.includes("addPendingFiles"));

console.log("screenshotSilentBehavior tests passed");
```

Add to `e2e/screenshotData.spec.ts`:

```ts
test("does not read the removed screenshot hide-window setting", () => {
  const footerSource = fs.readFileSync(
    "src/pages/chat/queryChat/ChatFooter/index.tsx",
    "utf8",
  );
  expect(footerSource).not.toContain("screenshotHideWindow");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/screenshotSilentBehavior.test.cts
npx playwright test e2e/screenshotData.spec.ts --workers=1
```

Expected before implementation: tests fail because the global trigger manipulates the main window and the renderer still reads `screenshotHideWindow`.

- [ ] **Step 3: Implement the no-hide screenshot API**

1. Replace `triggerScreenshot` with:

```ts
export const triggerScreenshot = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IpcMainToRender.triggerScreenshot);
};
```

2. Change the main handler to `ipcMain.handle(IpcRenderToMain.startScreenshot, async () => {`. Remove hide/wait/finally-show-focus logic. Select the display from the focused window when available, otherwise the cursor display, then the primary display.
3. Preserve native overlay, macOS capture, `node-screenshots`, Windows `screen.dipToScreenPoint`, thumbnail fallback, PNG diagnostics, permission errors and result shape.
4. Expose the preload method as:

```ts
const startScreenshot = (): Promise<{
  dataUrl: string;
  isSelection: boolean;
} | null> => ipcRenderer.invoke(IpcRenderToMain.startScreenshot);
```

5. Change `IElectronAPI.startScreenshot` to `() => Promise<{ dataUrl: string; isSelection: boolean } | null>`.
6. Change `ChatFooter` to call `startScreenshot()` from both the button callback and `triggerScreenshot` subscription, without reading localStorage.
7. Remove `hideWindowConfig`, `configOpen`, screenshot Popover content, localStorage reads/writes and dropdown arrow in `SendActionBar`; change `onScreenshot` to `() => void` and invoke it directly.
8. Keep clipboard writes, image queue insertion, crop confirmation and existing screenshot errors unchanged.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/screenshotSilentBehavior.test.cts
npx playwright test e2e/screenshotData.spec.ts e2e/screenshotModuleLoading.spec.ts --workers=1
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- electron/main/windowManage.ts electron/main/ipcHandlerManage.ts electron/preload/index.ts src/types/globalExpose.d.ts src/pages/chat/queryChat/ChatFooter/index.tsx src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx e2e/screenshotData.spec.ts scripts/screenshotSilentBehavior.test.cts
git commit -m "fix: keep background screenshots silent"
```

---

### Task 3: 为图片预览增加“另存为”

**Files:**

- Modify: `src/pages/chat/queryChat/ChatContent.tsx:551-590` to add the save-as action beside the existing image download action
- Modify: `src/utils/downloadFileName.ts:8-24` to recognize GIF, BMP and WEBP MIME types consistently
- Test: create `scripts/imagePreviewSaveAs.test.cts`

**Interfaces:**

- Consumes: `window.electronAPI.ipcInvoke("chooseDownloadPath", { fileName })`, `inferDownloadFileName`, `downloadFileWithProgress`, `t("placeholder.saveAs")`, and the existing image preview `originalUrl`.
- Produces: default download remains unchanged; save-as invokes the native save dialog and downloads to the selected absolute path.

- [ ] **Step 1: Write failing tests for the image preview actions**

Create `scripts/imagePreviewSaveAs.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const contentSource = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatContent.tsx"),
  "utf8",
);
const fileNameSource = fs.readFileSync(
  path.join(process.cwd(), "src/utils/downloadFileName.ts"),
  "utf8",
);
const ipcSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);

assert.ok(contentSource.includes("DownloadOutlined"));
assert.ok(contentSource.includes('t("placeholder.saveAs")'));
assert.ok(contentSource.includes('ipcInvoke<string | false>("chooseDownloadPath"'));
assert.ok(contentSource.includes("inferDownloadFileName({"));
assert.ok(contentSource.includes("filePath: selectedPath"));
assert.ok(contentSource.includes("showProgressToast: true"));
assert.ok(ipcSource.includes("IpcRenderToMain.chooseDownloadPath"));
assert.ok(fileNameSource.includes('"image/gif": "gif"'));
assert.ok(fileNameSource.includes('"image/bmp": "bmp"'));
assert.ok(fileNameSource.includes('"image/webp": "webp"'));

console.log("imagePreviewSaveAs tests passed");
```

The focused contract test must assert the same observable boundary in source: default download does not invoke `chooseDownloadPath`; “另存为” invokes it with the inferred file name; a `false` result returns before downloading; and a confirmed absolute path is passed as `filePath` to `downloadFileWithProgress`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
```

Expected before implementation: the test fails because `ChatContent.tsx` has no save-as action and does not call `chooseDownloadPath` or `inferDownloadFileName` for the image preview.

- [ ] **Step 3: Implement the minimal save-as action**

In `ChatContent.tsx`, keep the current download icon and callback intact. Add a second toolbar action immediately beside it:

```tsx
<SaveOutlined
  className="cursor-pointer text-lg text-white"
  title={t("placeholder.saveAs")}
  onClick={() => {
    if (!originalUrl) return;
    const fileName = inferDownloadFileName({ url: originalUrl });
    void (async () => {
      const selectedPath = await window.electronAPI.ipcInvoke<string | false>(
        "chooseDownloadPath",
        { fileName },
      );
      if (!selectedPath) return;
      await downloadFileWithProgress({
        url: originalUrl,
        fileName,
        filePath: selectedPath,
        showProgressToast: true,
        progressTitle: t("toast.downloading"),
      });
    })().catch((error) => {
      console.error("Save image as failed:", error);
    });
  }}
/>
```

Import `SaveOutlined` and `inferDownloadFileName` using the existing project import style. Preserve preview navigation, zoom, close, and default-download behavior. Add the missing image MIME mappings in `downloadFileName.ts`; do not change file-message download behavior.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
```

Expected: the static test passes, and the implementation contains no download call after a canceled dialog. A canceled dialog must not emit a download failure toast.

- [ ] **Step 5: Commit**

```powershell
git add -- src/pages/chat/queryChat/ChatContent.tsx src/utils/downloadFileName.ts scripts/imagePreviewSaveAs.test.cts
git commit -m "feat: add image save as action"
```

---

### Task 4: 统一 Linux/UOS “年糕”品牌与 `stickycake` 执行路径

**Files:**

- Modify: `electron-builder.json5:5-100` to set the Linux executable and package metadata without changing Windows outputs
- Modify: `scripts/linuxCreateDesktopShortcut.sh:1-330` to use the fixed Linux display name, executable, install directory and desktop file
- Modify: `scripts/linuxRemoveDesktopShortcut.sh:1-110` to remove the new managed shortcut safely and retain guarded legacy cleanup
- Modify: `scripts/afterPackBundledGlibc.cjs:1-20,230-270,1490-1520` to find and wrap the actual `年糕` executable under `/opt/stickycake`
- Modify: `build-linux-deb.sh:1-100` to use the internal package/path identifier `stickycake`
- Test: create `scripts/linuxBrandIdentity.test.cts`

**Interfaces:**

- Consumes: Electron Builder `productName`/`executableName`, generated Linux unpacked output, the deb maintainer scripts, and the bundled-glibc launcher.
- Produces: desktop display `年糕`, executable `/opt/stickycake/年糕`, desktop file `stickycake.desktop`, and desktop launch line `/opt/stickycake/年糕 %U`; Windows `StickyCake` artifacts remain unchanged.

- [ ] **Step 1: Write failing tests for the Linux naming contract**

Create `scripts/linuxBrandIdentity.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const builder = read("electron-builder.json5");
const createShortcut = read("scripts/linuxCreateDesktopShortcut.sh");
const removeShortcut = read("scripts/linuxRemoveDesktopShortcut.sh");
const glibc = read("scripts/afterPackBundledGlibc.cjs");
const deb = read("build-linux-deb.sh");

assert.match(builder, /productName: "年糕"/);
assert.match(builder, /executableName: "年糕"/);
assert.match(createShortcut, /APP_NAME="stickycake"/);
assert.match(createShortcut, /EXECUTABLE_NAME="年糕"/);
assert.match(createShortcut, /APP_DIR="\/opt\/stickycake"/);
assert.match(createShortcut, /SHORTCUT_NAME="stickycake\.desktop"/);
assert.match(createShortcut, /Name=年糕/);
assert.match(createShortcut, /Exec=\/opt\/stickycake\/年糕 %U/);
assert.match(removeShortcut, /SHORTCUT_NAME="stickycake\.desktop"/);
assert.match(glibc, /DEFAULT_EXECUTABLE_NAME = "年糕"/);
assert.match(glibc, /DEFAULT_LINUX_INSTALL_DIR = "\/opt\/stickycake"/);
assert.match(deb, /PRODUCT_NAME="stickycake"/);
assert.doesNotMatch(createShortcut, /Exec=\/opt\/StickyCake\/stickycake/);
assert.doesNotMatch(createShortcut, /Exec=\/opt\/OpenCorp-Base\/opencorp-base/);
assert.doesNotMatch(createShortcut, /EXECUTABLE_NAME="niangao"/);

console.log("linuxBrandIdentity tests passed");
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
```

Expected before implementation: the test fails because the current Linux shortcut still uses `StickyCake` as `APP_NAME`, `stickycake` as the executable, and `/opt/StickyCake/stickycake`; the bundled-glibc and custom deb scripts still use `OpenCorp-Base`/`opencorp-base` defaults.

- [ ] **Step 3: Implement the exact Linux mapping without changing Windows configuration**

1. In `electron-builder.json5`, retain the root `productName: "年糕"`, add Linux `executableName: "年糕"`, and leave the Windows artifact names, NSIS `shortcutName`, and `uninstallDisplayName` unchanged. Set Linux maintainer/package metadata to `stickycake` where it controls the Linux package identity.
2. In `linuxCreateDesktopShortcut.sh`, use these exact values for the new managed shortcut:

```sh
APP_NAME="stickycake"
DISPLAY_NAME="年糕"
EXECUTABLE_NAME="年糕"
APP_DIR="/opt/stickycake"
SHORTCUT_NAME="stickycake.desktop"
```

Write `Name=年糕`, `Exec=/opt/stickycake/年糕 %U`, and the existing application ID. Use `DISPLAY_NAME` for visible text and `APP_NAME` for internal logs/markers. Keep legacy cleanup restricted to the existing managed marker or explicit old executable path; do not treat arbitrary user desktop files as removable. 3. In `linuxRemoveDesktopShortcut.sh`, remove `stickycake.desktop` only when it is the managed file, and retain guarded removal of the old `opencorp-base.desktop` only when its marker or explicit old `Exec` proves it belongs to this application. 4. In `afterPackBundledGlibc.cjs`, make the defaults `DEFAULT_EXECUTABLE_NAME = "年糕"` and `DEFAULT_LINUX_INSTALL_DIR = "/opt/stickycake"`; have `findExecutable` prefer `appInfo.executableName` and verify the real generated file before renaming it to `年糕.real`. The generated launcher must execute that real file and use `/opt/stickycake` in runtime patching. 5. In `build-linux-deb.sh`, use `PRODUCT_NAME="stickycake"`, package `stickycake`, internal output directory `release/stickycake/${VERSION}`, and the actual unpacked executable directory produced by Electron Builder. Do not alter the Windows build scripts or `release/StickyCake` Windows output convention.
Write `Name=年糕`, `Exec=/opt/stickycake/年糕 %U`, and the existing application ID. Use `DISPLAY_NAME` for visible text and `APP_NAME` for internal logs/markers. Keep legacy cleanup restricted to the existing managed marker or explicit old executable path; do not treat arbitrary user desktop files as removable.

3. In `linuxRemoveDesktopShortcut.sh`, remove `stickycake.desktop` only when it is the managed file, and retain guarded removal of the old `opencorp-base.desktop` only when its marker or explicit old `Exec` proves it belongs to this application.

4. In `afterPackBundledGlibc.cjs`, make the defaults `DEFAULT_EXECUTABLE_NAME = "年糕"` and `DEFAULT_LINUX_INSTALL_DIR = "/opt/stickycake"`; have `findExecutable` prefer `appInfo.executableName` and verify the real generated file before renaming it to `年糕.real`. The generated launcher must execute that real file and use `/opt/stickycake` in runtime patching.

5. In `build-linux-deb.sh`, use `PRODUCT_NAME="stickycake"`, package `stickycake`, internal output directory `release/stickycake/${VERSION}`, and the actual unpacked executable directory produced by Electron Builder. Do not alter the Windows build scripts or `release/StickyCake` Windows output convention.

- [ ] **Step 4: Run the static contract test and a Linux packaging smoke check**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
npm run build:linux
```

Then inspect the generated Linux unpacked directory and desktop metadata with equivalent UOS/Linux commands:

```sh
UNPACKED_DIR="$(find release -type d -name '*-unpacked' | head -n 1)"
DESKTOP_FILE="$(find release -type f -name 'stickycake.desktop' | head -n 1)"
test -n "$UNPACKED_DIR"
test -n "$DESKTOP_FILE"
test -x "$UNPACKED_DIR/年糕"
grep -F 'Name=年糕' "$DESKTOP_FILE"
grep -F 'Exec=/opt/stickycake/年糕 %U' "$DESKTOP_FILE"
```

Expected: the executable file exists with execute permission, the desktop file points to the same executable name, and no generated new path uses `/opt/StickyCake`, `/opt/OpenCorp-Base`, `stickycake` as the executable, or `niangao`.

- [ ] **Step 5: Commit**

```powershell
git add -- electron-builder.json5 scripts/linuxCreateDesktopShortcut.sh scripts/linuxRemoveDesktopShortcut.sh scripts/afterPackBundledGlibc.cjs build-linux-deb.sh scripts/linuxBrandIdentity.test.cts
git commit -m "fix: align Linux branding and launch path"
```

---

### Task 5: 全量验证 Windows 回归与 UOS 现场验收

**Files:**

- Test: all files changed by Tasks 1-4 and their associated `scripts/*.test.cts` / `e2e/*.spec.ts` suites
- Verify: generated Linux artifacts under `release/` without adding generated files to source control

**Interfaces:**

- Consumes: the completed reminder, screenshot, save-as and Linux packaging changes.
- Produces: evidence that Windows behavior is unchanged, UOS behavior matches the requested two-entry reminder design, and the Linux launcher/desktop contract is internally consistent.

- [ ] **Step 1: Run all focused static tests**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/trayHover.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderState.test.cts
node --require ts-node/register/transpile-only scripts/taskbarMessageAttention.test.cts
node --require ts-node/register/transpile-only scripts/screenshotSilentBehavior.test.cts
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
```

Expected: every command exits with code 0 and prints its test-passed message.

- [ ] **Step 2: Run the frontend e2e and quality checks**

Run:

```powershell
npx playwright test e2e/screenshotData.spec.ts e2e/screenshotModuleLoading.spec.ts --workers=1
npm run lint
npm run build
```

Expected: the selected e2e tests, lint, and the production frontend build pass without changes to unrelated files.

- [ ] **Step 3: Confirm Windows package compatibility**

Run the existing Windows build command in the Windows packaging environment:

```powershell
npm run build:win
```

Verify that the output still uses the existing `release/StickyCake/${version}` directory, `StickyCake_${version}.exe` artifact naming, `StickyCake` installer behavior, and the existing Windows tray reminder path. Do not accept a Linux naming change that modifies those Windows outputs.

- [ ] **Step 4: Execute the UOS manual acceptance checklist**

On a clean UOS installation, verify each item in order:

1. Send a message while 年糕 is visible, minimized, and closed to tray. In every case, a Windows-style one-message reminder appears for approximately five seconds without stealing focus; the unread state, tooltip and tray flashing also update.
2. Move the pointer onto the tray icon. The custom panel appears only from tray hover and shows every unread conversation as its own block with sender/conversation name and body. The last block is “忽略全部”.
3. Move from the tray icon into the panel and back. The panel remains visible while either hit area is occupied, then hides after the existing delay when both are left.
4. Click one message block and confirm 年糕 opens the matching conversation. Click “忽略全部” and confirm all unread panel entries, tooltip content and tray flashing are cleared.
5. From the desktop and application menu, launch the installed program. Confirm the desktop label is “年糕”, the executable is `/opt/stickycake/年糕`, and the program opens successfully.
6. Use the global screenshot shortcut while 年糕 is in the background or minimized. Confirm the screenshot flow does not bring the main window forward or alter its previous state.
7. Open an image, verify default download still uses the default directory, then use “另存为” and confirm the native dialog allows a custom path. Cancel once and confirm no error is shown; confirm a selected path writes the image successfully.

- [ ] **Step 5: Review the final diff and record verification evidence**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, only requirement-related files are changed, generated artifacts are not accidentally staged, and the final summary includes the focused test, lint, build, packaging, and UOS manual results.
