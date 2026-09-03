# UOS 消息提醒、应用品牌、截图与图片另存为实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 UOS 消息弹窗、Linux 桌面启动、截图后台行为，并为图片预览增加自定义路径另存为，同时保持现有 Windows 和聊天发送流程不回归。

**Architecture:** 保留现有 Electron 主进程提醒窗口、原生截图、统一文件下载和主进程保存 IPC。将 UOS 提醒窗口稳定为不抢焦点的自绘通知，将 Linux 用户可见名称与 ASCII 执行文件名分离并统一 desktop/启动器路径，删除截图隐藏状态后让快捷键仅触发渲染层截图事件，图片预览复用 `chooseDownloadPath` + `downloadFileWithProgress`。

**Tech Stack:** Electron、Electron Builder、React、TypeScript、Ant Design、Playwright、Node.js、POSIX shell。

## Global Constraints

- UOS 消息提醒采用年糕自绘弹窗，不接入 UOS 系统通知中心。
- 桌面和弹窗等用户可见名称统一为“年糕”；Linux 实际可执行文件使用稳定的 ASCII 名称 `niangao`。
- 不修改消息协议、服务器接口、图片上传接口、托盘消息数据结构或现有 Windows 安装向导。
- 不新增独立截图窗口，不更换截图原生模块，不改变截图分辨率和 fallback 策略。
- 截图接口收敛为 `startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>`。
- 后台快捷键截图不得调用主窗口的 `show()`、`restore()` 或 `focus()`，也不得改变主窗口原有显示状态。
- 图片“下载”继续使用默认下载目录；“另存为”必须经过主进程保存对话框和统一下载 IPC。
- 用户取消图片另存为不视为下载失败，不显示错误提示。
- 实现每项行为时先写失败测试，运行并确认失败，再写最小生产代码，最后运行相关测试。
- 工作区中已有用户修改和未合并内容必须保留；只修改本计划列出的需求相关文件。

---

## 文件结构与责任边界

| 文件                                                          | 责任                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `electron/main/messageReminderManage.ts`                      | UOS/Windows 自绘消息弹窗的窗口生命周期、定位、加载和点击跳转 |
| `electron/main/windowManage.ts`                               | 主窗口状态、全局截图事件转发和任务栏提醒                     |
| `electron/main/ipcHandlerManage.ts`                           | 截图 IPC、保存 IPC、显示器选择和主进程文件写入               |
| `electron/main/shortcutManage.ts`                             | 全局截图快捷键注册和配置更新                                 |
| `electron/preload/index.ts`                                   | 将截图与保存能力安全暴露给渲染进程                           |
| `src/types/globalExpose.d.ts`                                 | Electron API 类型契约                                        |
| `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx` | 截图按钮，不再提供隐藏窗口选项                               |
| `src/pages/chat/queryChat/ChatFooter/index.tsx`               | 截图触发、剪贴板写入和待发送图片队列                         |
| `src/pages/chat/queryChat/ChatContent.tsx`                    | 图片预览工具栏的下载和另存为操作                             |
| `src/utils/downloadFileName.ts`                               | 普通文件和图片的文件名/MIME 扩展名推断                       |
| `electron-builder.json5`                                      | Linux executableName、安装包和桌面入口配置                   |
| `scripts/linuxCreateDesktopShortcut.sh`                       | 安装后创建和修正用户桌面快捷方式                             |
| `scripts/linuxRemoveDesktopShortcut.sh`                       | 卸载时清理本项目管理的快捷方式                               |
| `scripts/afterPackBundledGlibc.cjs`                           | bundled glibc 场景的 Linux 启动器和真实可执行文件            |
| `build-linux-deb.sh`                                          | 自定义 deb 构建入口与 electron-builder 输出目录              |
| `scripts/*.test.cts` / `e2e/*.spec.ts`                        | 源码契约、纯函数和构建配置回归测试                           |

---

### Task 1: 稳定 UOS 自绘消息弹窗

**Files:**

- Modify: `electron/main/messageReminderManage.ts:1-280`
- Test: `scripts/messageReminderUos.test.cts`
- Test: `scripts/messageReminderUtils.test.cts`

**Interfaces:**

- Consumes: `ReminderPayload`, `addReminderConversation`, tray synchronization, and `openim-tray://conversation/<conversationID>`.
- Produces: existing `showMessageReminder(payload: ReminderPayload): void`, `hideMessageReminder(): void`, and `clearMessageReminderConversation(conversationID: string): void`.

- [ ] **Step 1: Write the failing tests**

Append these assertions to `scripts/messageReminderUos.test.cts`:

```ts
assert.ok(source.includes("skipTaskbar: true"));
assert.ok(source.includes("focusable: false"));
assert.ok(
  source.includes('backgroundColor: isLinuxReminder ? "#181c24" : "#00000000"'),
);
assert.ok(source.includes("window.showInactive()"));
assert.ok(source.includes("openim-tray://conversation/"));
assert.ok(source.includes("!window.isDestroyed()"));
assert.ok(source.includes("reminderLoadRequest"));
```

Also assert that showing a message does not depend on tray hover:

```ts
assert.ok(source.includes("export const showMessageReminder"));
assert.ok(!source.includes("showTrayReminderPanel("));
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
```

Expected before implementation: the test fails at the missing `reminderLoadRequest` assertion. A loader error is not an acceptable RED result; if it occurs, use the installed TypeScript runner to execute the same test and then rerun until an assertion about the missing behavior fails.

- [ ] **Step 3: Implement the minimal lifecycle fix**

In `electron/main/messageReminderManage.ts`:

1. Keep the existing reminder dimensions, work-area placement, 5-second timeout, text escaping, tray state synchronization, and URL click handling.
2. Keep Linux notification properties opaque and non-activating:

```ts
skipTaskbar: true,
show: false,
alwaysOnTop: true,
focusable: false,
transparent: false,
backgroundColor: "#181c24",
```

Preserve the current non-Linux transparent configuration. 3. Add `let reminderLoadRequest = 0;`. Each `showMessageReminder` call increments it, captures the request id, and registers a `did-finish-load` callback for its `loadURL` call. The callback may call `window.showInactive()` only when the window is not destroyed and its request id equals the latest request id. 4. Do not create a new BrowserWindow for each message. Do not call `focus()` or the main-window `showWindow()` from the reminder path. 5. Keep `setAlwaysOnTop(true, isLinuxReminder ? "pop-up-menu" : "screen-saver")`, bottom-right work-area positioning, `openim-tray://conversation/<id>` click routing, and timeout hiding. 6. If an old load callback fires after a newer message, it must not display stale content.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderUtils.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderState.test.cts
```

Expected: all commands exit 0 and print their existing test-passed messages.

- [ ] **Step 5: Commit**

```powershell
git add -- electron/main/messageReminderManage.ts electron/main/messageReminderState.ts scripts/messageReminderUos.test.cts scripts/messageReminderUtils.test.cts
git commit -m "fix: stabilize UOS message reminder"
```

---

### Task 2: 删除截图隐藏选项并保持后台截图静默

**Files:**

- Modify: `electron/main/windowManage.ts:145-160`
- Modify: `electron/main/ipcHandlerManage.ts:618-855`
- Modify: `electron/preload/index.ts:147-153`
- Modify: `src/types/globalExpose.d.ts:34-39`
- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx:74-225,290-325`
- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx:370-415,750-765`
- Test: `e2e/screenshotData.spec.ts`
- Test: create `scripts/screenshotSilentBehavior.test.cts`

**Interfaces:**

- Consumes: existing screenshot IPC, `IpcMainToRender.triggerScreenshot`, native screenshot/fallback capture, and clipboard writing.
- Produces: `triggerScreenshot(): void` that only sends the renderer event, and `startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>` with no parameter.

- [ ] **Step 1: Write the failing tests**

Create `scripts/screenshotSilentBehavior.test.cts` with:

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

Expected before implementation: the new test fails because the current global trigger manipulates the main window and the renderer still reads `screenshotHideWindow`.

- [ ] **Step 3: Implement the minimal no-hide API**

1. Replace `triggerScreenshot` in `windowManage.ts` with:

```ts
export const triggerScreenshot = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IpcMainToRender.triggerScreenshot);
};
```

2. Change the main IPC handler to `ipcMain.handle(IpcRenderToMain.startScreenshot, async () => {`. Remove hide-window logging, the hide/wait block, and the final show/focus block. If no window is focused, select `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())`; use `screen.getPrimaryDisplay()` only as the final fallback.
3. Preserve the native overlay, macOS capture, `node-screenshots`, Windows `screen.dipToScreenPoint`, thumbnail fallback, PNG diagnostics, permission error, and `{ dataUrl, isSelection }` result.
4. Expose the no-argument preload method:

```ts
const startScreenshot = (): Promise<{
  dataUrl: string;
  isSelection: boolean;
} | null> => ipcRenderer.invoke(IpcRenderToMain.startScreenshot);
```

5. Change `IElectronAPI.startScreenshot` to `() => Promise<{ dataUrl: string; isSelection: boolean } | null>`.
6. Change `ChatFooter`'s callback signature from `(hideWindow: boolean)` to `()`, call `window.electronAPI.startScreenshot()`, and use this event handler:

```ts
const unsubscribe = window.electronAPI?.subscribe("triggerScreenshot", () => {
  void startScreenshot();
});
```

7. In `SendActionBar`, remove `hideWindowConfig`, `configOpen`, the localStorage reads/writes, `screenshotConfigContent`, the screenshot Popover/arrow, and change `onScreenshot` to `() => void`. The screenshot icon calls `onScreenshot()` directly.
8. Keep clipboard writes, selected-image queue insertion, full-screen preview editing, final cropped-image clipboard writes, and existing errors unchanged.

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

- Modify: `src/pages/chat/queryChat/ChatContent.tsx:1-20,217-240,550-595`
- Modify: `src/utils/downloadFileName.ts:1-110`
- Test: create `scripts/imagePreviewSaveAs.test.cts`
- Test: `e2e/downloadFileName.spec.ts`

**Interfaces:**

- Consumes: `downloadFileWithProgress({ url, fileName?, filePath?, showProgressToast?, progressTitle? })`, `window.electronAPI.ipcInvoke("chooseDownloadPath", { fileName })`, and `inferDownloadFileName`.
- Produces: the existing default image download action plus an explicit Save As action that passes the selected path to the unified download helper.

- [ ] **Step 1: Write the failing tests**

Create `scripts/imagePreviewSaveAs.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(process.cwd(), "src/pages/chat/queryChat/ChatContent.tsx"),
  "utf8",
);

assert.ok(source.includes("chooseDownloadPath"));
assert.ok(source.includes("downloadFileWithProgress"));
assert.ok(source.includes("filePath: selectedPath"));
assert.ok(source.includes('t("placeholder.saveAs")'));
assert.ok(source.includes('title={t("placeholder.saveAs")}'));
assert.ok(source.includes('aria-label={t("placeholder.saveAs")}'));
assert.ok(source.includes("if (!selectedPath) return"));

console.log("imagePreviewSaveAs tests passed");
```

Extend `e2e/downloadFileName.spec.ts` with:

```ts
test("infers common image extensions for preview save as", () => {
  expect(
    inferDownloadFileName({
      url: "https://example.test/image/1",
      mimeType: "image/png",
    }),
  ).toBe("download.png");
  expect(inferDownloadFileName({ url: "https://example.test/image/photo.JPG" })).toBe(
    "photo.JPG",
  );
  expect(
    inferDownloadFileName({
      url: "https://example.test/image/1",
      mimeType: "image/gif",
    }),
  ).toBe("download.gif");
  expect(
    inferDownloadFileName({
      url: "https://example.test/image/1",
      mimeType: "image/webp",
    }),
  ).toBe("download.webp");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
npx playwright test e2e/downloadFileName.spec.ts --workers=1
```

Expected before implementation: the source test fails because the image toolbar has no path chooser or Save As button; GIF/WEBP cases fail because the MIME map lacks those extensions.

- [ ] **Step 3: Implement the minimal image Save As flow**

1. Add these entries to `MIME_EXTENSIONS` in `src/utils/downloadFileName.ts`:

```ts
"image/gif": "gif",
"image/bmp": "bmp",
"image/webp": "webp",
```

Keep the existing priority: valid caller filename, content disposition, URL path, MIME extension, then `download`.

2. In `ChatContent.tsx`, import `SaveOutlined`. Add a component-level callback with this exact behavior:

```ts
const handleImageSaveAs = useCallback(async (url: string, fileName?: string) => {
  if (!url || !window.electronAPI?.ipcInvoke) return;
  const selectedPath = await window.electronAPI.ipcInvoke<string | false>(
    "chooseDownloadPath",
    { fileName },
  );
  if (!selectedPath) return;
  await downloadFileWithProgress({
    url,
    fileName,
    filePath: selectedPath,
    showProgressToast: true,
    progressTitle: t("toast.downloading"),
  });
}, []);
```

If lint requires dependencies, include the stable callback dependencies used by the component. Do not create a second download implementation.

3. In `toolbarRender`, derive a source URL exactly as the current download action does. Derive a default image name from the URL when no message filename field exists by passing `undefined` to `downloadFileWithProgress`; the unified response URL/MIME inference will produce the extension. Render the existing download icon plus a button wrapping `SaveOutlined`:

```tsx
<button
  type="button"
  title={t("placeholder.saveAs")}
  aria-label={t("placeholder.saveAs")}
  className="text-white"
  onClick={() => {
    if (!originalUrl) return;
    void handleImageSaveAs(originalUrl).catch((error) => {
      console.error("Save image as failed:", error);
    });
  }}
>
  <SaveOutlined className="cursor-pointer text-lg" />
</button>
```

The existing download icon must not call `chooseDownloadPath`. A false/empty selected path must return before starting the download and must not call an error toast.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
npx playwright test e2e/downloadFileName.spec.ts --workers=1
```

Expected: all selected tests pass, including the existing unified image-download contract.

- [ ] **Step 5: Commit**

```powershell
git add -- src/pages/chat/queryChat/ChatContent.tsx src/utils/downloadFileName.ts scripts/imagePreviewSaveAs.test.cts e2e/downloadFileName.spec.ts
git commit -m "feat: add image preview save as"
```

---

### Task 4: 统一 Linux/UOS 桌面品牌和执行路径

**Files:**

- Modify: `electron-builder.json5:1-125`
- Modify: `scripts/linuxCreateDesktopShortcut.sh:1-220`
- Modify: `scripts/linuxRemoveDesktopShortcut.sh:1-100`
- Modify: `scripts/afterPackBundledGlibc.cjs:1-15,235-255,335-350,1485-1535`
- Modify: `build-linux-deb.sh:1-100`
- Modify: `scripts/writeDebUpdateManifest.cjs:1-25` only if the output path remains inconsistent
- Test: create `scripts/linuxBrandIdentity.test.cts`
- Test: modify `scripts/brandIdentity.test.cts` only where its expectations describe the old Linux user-facing name

**Interfaces:**

- Consumes: electron-builder `productName`, `executableName`, `appInfo.executableName`, deb lifecycle scripts, and the current `release/StickyCake/${version}` output convention.
- Produces: Linux package with user-visible name “年糕”, actual executable `niangao`, matching desktop `Exec`, matching bundled-glibc launcher, and a desktop shortcut that launches successfully.

- [ ] **Step 1: Write the failing tests**

Create `scripts/linuxBrandIdentity.test.cts`:

```ts
import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const builder = read("electron-builder.json5");
const createShortcut = read("scripts/linuxCreateDesktopShortcut.sh");
const removeShortcut = read("scripts/linuxRemoveDesktopShortcut.sh");
const afterPack = read("scripts/afterPackBundledGlibc.cjs");
const debScript = read("build-linux-deb.sh");

assert.match(builder, /productName:\s*"年糕"/);
assert.match(builder, /executableName:\s*"niangao"/);
assert.match(createShortcut, /SHORTCUT_DISPLAY_NAME="年糕"/);
assert.match(createShortcut, /EXECUTABLE_NAME="niangao"/);
assert.match(createShortcut, /APP_DIR="\/opt\/niangao"/);
assert.match(createShortcut, /Exec=\/opt\/niangao\/niangao %U/);
assert.match(removeShortcut, /SHORTCUT_NAME="niangao\.desktop"/);
assert.doesNotMatch(createShortcut, /Exec=\/opt\/OpenCorp-Base\/opencorp-base/);
assert.doesNotMatch(createShortcut, /Exec=\/opt\/StickyCake\/stickycake/);
assert.doesNotMatch(afterPack, /DEFAULT_LINUX_INSTALL_DIR = "\/opt\/OpenCorp-Base"/);
assert.doesNotMatch(afterPack, /DEFAULT_EXECUTABLE_NAME = "opencorp-base"/);
assert.doesNotMatch(debScript, /OUTPUT_DIR="release\/Base\//);

console.log("linuxBrandIdentity tests passed");
```

Update `scripts/brandIdentity.test.cts` to assert the intended user-facing brand:

```ts
assert.match(builderSource, /productName:\s*"年糕"/);
assert.match(linuxShortcutSource, /SHORTCUT_DISPLAY_NAME="年糕"/);
```

Keep `StickyCake` assertions only for Windows artifact names or explicitly internal compatibility. Do not require it as the Linux desktop display name.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
node --require ts-node/register/transpile-only scripts/brandIdentity.test.cts
```

Expected before implementation: the new test fails on the missing Linux `executableName`, old shortcut display/path, old bundled-glibc defaults, and `release/Base` output path.

- [ ] **Step 3: Implement one consistent Linux executable identity**

1. Add `executableName: "niangao"` under `linux` in `electron-builder.json5`. Keep `productName: "年糕"`. Keep Windows/macOS artifact names `StickyCake_*` unless builder validation requires a scoped change.

2. In `scripts/linuxCreateDesktopShortcut.sh`, use:

```sh
APP_NAME="niangao"
EXECUTABLE_NAME="niangao"
DISPLAY_NAME="年糕"
APP_DIR="/opt/$APP_NAME"
SHORTCUT_DISPLAY_NAME="$DISPLAY_NAME"
SHORTCUT_NAME="${EXECUTABLE_NAME}.desktop"
```

Use `Exec=/opt/niangao/niangao %U`, `Icon=niangao`, and `StartupWMClass=niangao` in fallback and copied desktop files. Keep the existing logged-in-user discovery and ownership logic. Use a new explicit marker such as `X-Niangao-Managed-Desktop-Shortcut=true`; recognize the old marker only when the file also contains an old project execution path, so unrelated user files are not deleted.

3. In `scripts/linuxRemoveDesktopShortcut.sh`, remove only `niangao.desktop` and legacy project-managed files. Do not remove arbitrary `StickyCake.desktop` files unless their contents contain the old project marker or old project `Exec` path.

4. In `scripts/afterPackBundledGlibc.cjs`:

- Set `DEFAULT_EXECUTABLE_NAME = "niangao"`.
- Set `DEFAULT_LINUX_INSTALL_DIR = "/opt/niangao"`.
- Keep `findExecutable` preferring `appInfo.executableName`, then product filename/name, then the default.
- Keep `getLinuxInstallDir` preferring `BUNDLED_GLIBC_LINUX_INSTALL_DIR`; otherwise derive `/opt/${appInfo.executableName || "niangao"}`.
- Ensure the renamed executable is `${actualExecutableName}.real` and the generated launcher retains the actual executable basename.

5. In `build-linux-deb.sh`, use the builder output directory:

```bash
PRODUCT_NAME="StickyCake"
OUTPUT_DIR="release/StickyCake/${VERSION}"
```

Do not copy the unpacked application into a second incompatible package layout. If this custom script remains supported, derive `UNPACKED_DIR` by locating the actual `linux-unpacked` directory under `OUTPUT_DIR`, and do not reintroduce `OpenCorp-Base` execution paths.

6. Leave `scripts/writeDebUpdateManifest.cjs` using `release/StickyCake/${version}`, which is the output directory configured by `electron-builder.json5`.

- [ ] **Step 4: Run the tests and inspect the effective config**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
node --require ts-node/register/transpile-only scripts/brandIdentity.test.cts
npx electron-builder --config electron-builder.json5 --linux --x64 --dir --publish never
```

Expected: tests pass and the builder command exits 0. Inspect the generated output:

```powershell
$version = node -p "require('./package.json').version"
Get-ChildItem "release/StickyCake/$version" -Recurse -File |
  Where-Object { $_.Name -eq 'niangao' -or $_.Name -eq '年糕' -or $_.Name -eq 'builder-effective-config.yaml' } |
  Select-Object FullName, Length
```

The effective config and unpacked directory must use the configured executable identity. If the builder output contradicts `executableName: "niangao"`, correct the configuration and launcher derivation before continuing; do not point desktop files to a guessed filename.

- [ ] **Step 5: Commit**

```powershell
git add -- electron-builder.json5 scripts/linuxCreateDesktopShortcut.sh scripts/linuxRemoveDesktopShortcut.sh scripts/afterPackBundledGlibc.cjs build-linux-deb.sh scripts/writeDebUpdateManifest.cjs scripts/linuxBrandIdentity.test.cts scripts/brandIdentity.test.cts
git commit -m "fix: align Linux app branding and launcher"
```

Omit `scripts/writeDebUpdateManifest.cjs` if unchanged.

---

### Task 5: 跨功能验证与 UOS 安装包验收

**Files:**

- Modify: `README.zh-CN.md` only if the final Linux build/installation command changes
- Test: all tests created or modified in Tasks 1-4

**Interfaces:**

- Consumes: completed reminder, screenshot, image Save As, builder, and desktop-script contracts.
- Produces: verified source, frontend bundle, Electron bundle, Linux artifact metadata, and a documented list of checks requiring a physical UOS desktop.

- [ ] **Step 1: Run all focused source and pure-function tests**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/messageReminderUos.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderUtils.test.cts
node --require ts-node/register/transpile-only scripts/messageReminderState.test.cts
node --require ts-node/register/transpile-only scripts/screenshotSilentBehavior.test.cts
node --require ts-node/register/transpile-only scripts/linuxBrandIdentity.test.cts
node --require ts-node/register/transpile-only scripts/brandIdentity.test.cts
node --require ts-node/register/transpile-only scripts/downloadPathAndAtEscape.test.cts
node --require ts-node/register/transpile-only scripts/screenshotShortcut.test.cts
node --require ts-node/register/transpile-only scripts/taskbarMessageAttention.test.cts
node --require ts-node/register/transpile-only scripts/imagePreviewSaveAs.test.cts
```

Expected: every command exits 0 and prints its test-passed message. Existing checks for `StickyCake` may remain only where they explicitly cover Windows artifacts or internal compatibility.

- [ ] **Step 2: Run focused Playwright contract tests**

Run:

```powershell
npx playwright test e2e/downloadFileName.spec.ts e2e/screenshotData.spec.ts e2e/screenshotModuleLoading.spec.ts e2e/fileDownloadDiagnostics.spec.ts --workers=1
```

Expected: all selected tests pass with zero failed tests.

- [ ] **Step 3: Run lint and the application build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit 0. Non-zero exit codes or TypeScript/Vite errors block completion.

- [ ] **Step 4: Build and inspect Linux metadata**

Run:

```powershell
npx electron-builder --config electron-builder.json5 --linux deb --x64 --publish never
```

Inspect:

```powershell
$version = node -p "require('./package.json').version"
Get-ChildItem "release/StickyCake/$version" -Force |
  Select-Object Name, Length
Get-ChildItem "release/StickyCake/$version" -Recurse -File |
  Where-Object { $_.Name -match 'niangao|\.desktop$|builder-effective-config\.yaml' } |
  Select-Object FullName, Length
```

Expected: the Linux unpacked directory contains an executable named `niangao`; the effective config contains product name “年糕”; generated desktop metadata, if present, points to the same executable. If a Linux build cannot run on Windows because the host lacks the required Linux builder, report that exact limitation and complete the static checks without claiming package success.

- [ ] **Step 5: Perform UOS manual acceptance when a Linux desktop is available**

Install the generated deb and verify:

1. The desktop shortcut displays “年糕”.
2. Double-clicking the shortcut starts the application without a missing-executable error.
3. A new message displays a bottom-right self-drawn notification containing sender/conversation and body text.
4. Hovering the tray icon still shows the tray conversation panel.
5. Clicking the notification opens the correct conversation.
6. The screenshot action has no hide/show menu.
7. Pressing `Ctrl+Shift+X` while the app is hidden or minimized does not bring the main window to the foreground.
8. Completing or cancelling the screenshot does not change the original visibility, minimized, or focus state.
9. Image Download saves to the configured default directory; image Save as opens a path chooser and writes to the chosen path.
10. Cancelling Save as does not show a failure toast.

- [ ] **Step 6: Review the final diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: `git diff --check` reports no whitespace errors and the diff contains only files required by this plan. Do not add generated release artifacts unless the repository already tracks them and the user explicitly requests them.

- [ ] **Step 7: Commit the verified implementation**

```powershell
git add -- electron src scripts e2e electron-builder.json5 build-linux-deb.sh README.zh-CN.md
git commit -m "fix: complete UOS desktop experience"
```

Run `git status --short` after the commit and confirm the intended working-tree state before reporting completion.

---

## Plan self-review

- UOS full message popup: Task 1 covers opaque/non-focusable window properties, stable loading, escaping, click routing, timeout, and independence from tray hover.
- Linux desktop name and startup: Task 4 covers builder executableName, desktop scripts, bundled glibc launcher, deb output, legacy-path cleanup, and artifact inspection.
- Screenshot option removal and silent background shortcut: Task 2 covers UI removal, API signature, main-window trigger behavior, display selection, and preservation of clipboard/send/fallback behavior.
- Image Save As: Task 3 covers toolbar UI, path chooser, unified download path, MIME extensions, cancellation, and separation from default Download.
- Regression protection: Task 5 covers focused tests, existing contract tests, lint, frontend build, Linux build, package inspection, and UOS manual checks.
- No task uses `TODO`, `TBD`, or an unspecified “appropriate” implementation action.
- Interfaces are consistent: `startScreenshot()` has no parameters in the main handler, preload API, global type, footer callback, and action-bar prop; image Save As always uses `chooseDownloadPath` followed by `downloadFileWithProgress({ filePath })`.
