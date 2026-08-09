# 聊天操作栏、原生截图与 Windows 静默安装实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复消息操作栏遮挡、服务器截图退化为缩略图和 Windows NSIS 静默安装支持，并用构建、辅助测试和打包检查验证结果。

**Architecture:** 保留现有消息操作栏 React 结构和截图 IPC 返回结构。消息操作栏仅通过 CSS 改为消息右上方绝对定位；截图在主进程中修正 DIP 到物理像素的转换，优先使用 `node-screenshots` 原生 PNG，并将完整诊断写入现有 `electron-log` 文件日志；Windows 安装器继续使用当前 NSIS assisted/per-machine 配置，补充部署文档和构建验证。

**Tech Stack:** React 18、SCSS/Tailwind、Electron 22、electron-builder 23.6、`node-screenshots`、`electron-log`、Playwright test、Vite。

## Global Constraints

- 不改变消息协议、组织结构接口、图片上传接口或截图确认后的待发送附件流程。
- 不切换 NSIS 的 `oneClick` 模式；保持 `oneClick: false`、`perMachine: true`、`allowElevation: true`。
- 不使用 `desktopCapturer.thumbnail` 作为首选截图结果；它只能保留为最后 fallback，并必须记录实际尺寸和失败原因。
- Windows 坐标转换必须使用 Electron 的 `screen.dipToScreenPoint()`，因为 `display.bounds` 是 DIP 坐标而 `node-screenshots` 使用物理像素坐标。
- 保留工作区中已有的消息样式改动；不使用 `git checkout`、`git reset` 或覆盖式恢复。
- 每个任务完成后运行该任务列出的最小验证；全部任务完成后再运行完整构建、lint、e2e 和 Windows 打包验证。

---

### Task 1: 将消息操作栏定位到消息右上方

**Files:**

- Modify: `src/pages/chat/queryChat/MessageItem/message-item.module.scss:32-121`
- Verify: `src/pages/chat/queryChat/MessageItem/index.tsx` 保持现有操作项、hover 和事件冒泡逻辑不变

**Interfaces:**

- Consumes: `MessageItem/index.tsx` 当前渲染的 `.menu-wrap > .actionToolbar` DOM 结构。
- Produces: 操作栏仍由 hover 状态控制，但绝对定位在消息内容右上方，不再按发送方镜像到消息左侧。

- [ ] **Step 1: 记录修复前的 CSS 行为**

运行：

```powershell
rg -n -C 3 "actionToolbar|top: 50%|left: calc|right: calc|translateY\(-50%\)" src/pages/chat/queryChat/MessageItem/message-item.module.scss
```

预期：当前规则包含 `top: 50%`、接收方 `left: calc(100% + 8px)`、发送方 `right: calc(100% + 8px)` 和 `translateY(-50%)`。

- [ ] **Step 2: 修改最小布局规则**

将 `.actionToolbar` 的定位规则调整为消息右上方，保留现有颜色、阴影、按钮尺寸和 hover 样式：

```scss
.actionToolbar {
  position: absolute;
  top: -44px;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  white-space: nowrap;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(31, 35, 41, 0.1), 0 1px 3px rgba(31, 35, 41, 0.06);
  animation: actionToolbarIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

删除 `.message-container-sender .actionToolbar` 中覆盖 `right/left` 的镜像规则。将动画从垂直居中位移改为从右上方轻微下移进入：

```scss
@keyframes actionToolbarIn {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

保留 `.message-container` 和 `.message-wrap` 的 `overflow: visible`，使操作栏不会被消息自身容器裁剪；不要修改消息正文或 `MessageSuffix` 的既有样式。

- [ ] **Step 3: 运行样式编译验证**

运行：

```powershell
npm run build
```

预期：命令退出码为 `0`，没有 SCSS 解析错误；生成的 `dist` 包含消息样式。

- [ ] **Step 4: 做 UI 回归检查**

在聊天窗口中检查以下四种场景：

1. 接收方短文本消息；
2. 接收方长文本消息；
3. 发送方消息；
4. 消息靠近聊天区域右边界时。

预期：操作栏始终出现在消息气泡右上方，正文没有被覆盖；发送方不再将操作栏镜像到消息左侧；点击操作按钮不会触发消息行选择。

- [ ] **Step 5: 提交任务变更**

运行：

```powershell
git add -- src/pages/chat/queryChat/MessageItem/message-item.module.scss
git commit -m "fix: place message actions above bubble"
```

预期：只提交消息操作栏布局相关变更。

---

### Task 2: 修复原生截图分辨率并增加持久化诊断

**Files:**

- Create: `electron/utils/pngDimensions.ts`
- Modify: `electron/main/ipcHandlerManage.ts:1-50,281-441`
- Modify: `e2e/screenshotData.spec.ts`
- Verify: `electron-builder.json5:7-8,15-25` 保留 `asar`/`asarUnpack`，必要时只补充原生模块打包验证，不改变无关资源排除规则

**Interfaces:**

- Consumes: `startScreenshot` IPC 当前返回的 `{ dataUrl, isSelection }` 接口、`screen.getDisplayMatching()`、`node-screenshots.Monitor`。
- Produces: `getPngDimensions(bytes: Uint8Array): { width: number; height: number }` 纯函数；主进程原生截图结果仍返回 `{ dataUrl, isSelection: false }`，但日志包含实际 PNG 尺寸和 fallback 诊断。

- [ ] **Step 1: 写 PNG 尺寸解析的失败测试**

在 `e2e/screenshotData.spec.ts` 增加以下测试，先导入尚不存在的 `getPngDimensions`：

```ts
import { getPngDimensions } from "../electron/utils/pngDimensions";

test("reads width and height from a PNG IHDR header", () => {
  const pngHeader = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x07, 0x80, 0x00, 0x00, 0x04, 0x38,
  ]);

  expect(getPngDimensions(pngHeader)).toEqual({ width: 1920, height: 1080 });
});

test("rejects data that is not long enough to contain PNG dimensions", () => {
  expect(() => getPngDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(
    "Invalid PNG data",
  );
});
```

运行：

```powershell
npx playwright test e2e/screenshotData.spec.ts
```

预期：新增测试因 `../electron/utils/pngDimensions` 不存在而失败；失败原因应是缺少实现，而不是测试语法错误。

- [ ] **Step 2: 实现最小 PNG 尺寸解析函数**

创建 `electron/utils/pngDimensions.ts`，实现 PNG signature 校验，并从 IHDR 的固定偏移读取大端宽高：

```ts
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const getPngDimensions = (bytes: Uint8Array) => {
  if (
    bytes.length < 24 ||
    PNG_SIGNATURE.some((value, index) => bytes[index] !== value) ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    throw new Error("Invalid PNG data");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
};
```

- [ ] **Step 3: 运行 PNG 辅助测试确认 GREEN**

运行：

```powershell
npx playwright test e2e/screenshotData.spec.ts
```

预期：现有 data URL 测试和两个 PNG 尺寸测试全部通过。

- [ ] **Step 4: 修正 Windows 原生显示器坐标和日志边界**

在 `electron/main/ipcHandlerManage.ts`：

1. 从 `electron/main/index.ts` 引入现有 `logger`，截图诊断使用 `logger.info/warn/error`，不只使用 `console`；
2. 在进入截图处理后记录 `app.isPackaged`、`process.resourcesPath`、display id、DIP bounds 和 scale factor；
3. 将当前代码：

```ts
if (process.platform === "win32") {
  point = screen.screenToDipPoint(point);
}
```

替换为：

```ts
if (process.platform === "win32") {
  point = screen.dipToScreenPoint(point);
}
```

4. 对 `node-screenshots` 原生路径记录 `monitor.id()`、`monitor.x()`、`monitor.y()`、`monitor.width()`、`monitor.height()`、`monitor.scaleFactor()`；
5. 对 `buffer` 调用 `getPngDimensions(buffer)`，记录 PNG 宽高和字节数后再返回 data URL；
6. native overlay 的 `ok` 回调也记录选区 PNG 的字节数和宽高；
7. 原生路径失败时记录错误名称、消息和堆栈；`node-screenshots` 失败后明确使用 `thumbnail fallback` 标记；
8. fallback 记录 `thumbnailSize` 请求值、source id/display id、`source.thumbnail.isEmpty()` 和 `source.thumbnail.getSize()`，然后保留现有 `toDataURL()` 返回行为。

日志字段示例：

```ts
logger.info("[screenshot] native monitor success", {
  displayId: display.id,
  monitorId: monitor.id(),
  monitorSize: { width: monitor.width(), height: monitor.height() },
  pngSize: getPngDimensions(buffer),
  bytes: buffer.byteLength,
});
```

异常对象要使用结构化字段或 `String(error)`，确保日志文件中不会只出现 `[object Object]`。

- [ ] **Step 5: 运行截图辅助测试和 TypeScript/Vite 构建**

运行：

```powershell
npx playwright test e2e/screenshotData.spec.ts
npm run build
```

预期：两个命令都退出码为 `0`；构建产物中存在 `dist-electron/main/ipcHandlerManage.js` 和 `dist-electron/utils/pngDimensions.js`，并且构建没有 Electron/Node 类型错误。

- [ ] **Step 6: 检查原生模块进入打包内容**

在 Windows 环境运行：

```powershell
npm run build:win
npx --no-install asar list "release/StickyCake/3.8.11/win-unpacked/resources/app.asar" | Select-String -Pattern "node-screenshots|electron-screenshots"
Get-ChildItem "release/StickyCake/3.8.11/win-unpacked/resources/app.asar.unpacked" -Recurse -Filter "*.node"
```

预期：

- `app.asar` 列表包含 `node-screenshots/index.js`、Windows 平台 `node-screenshots` package 和 `electron-screenshots`；
- `app.asar.unpacked` 中存在 Windows `.node` 原生文件；
- `release/StickyCake/3.8.11/StickyCake_3.8.11.exe` 生成成功。

如果版本号不是 `3.8.11`，将命令中的目录替换为 `package.json` 的实际版本目录，不修改构建产物路径配置。

- [ ] **Step 7: 提交截图任务变更**

运行：

```powershell
git add -- electron/utils/pngDimensions.ts electron/main/ipcHandlerManage.ts e2e/screenshotData.spec.ts
git commit -m "fix: keep native screenshot resolution and add diagnostics"
```

预期：只提交 PNG 辅助函数、截图主进程链路和对应测试。

---

### Task 3: 文档化 NSIS `/S` 静默安装并验证现有配置

**Files:**

- Modify: `README.zh-CN.md:120-160`
- Modify: `README.md:121-155`
- Verify: `electron-builder.json5:106-115`

**Interfaces:**

- Consumes: 当前 NSIS assisted/per-machine 配置和 `npm run build:win` 构建入口。
- Produces: 面向部署脚本的稳定安装命令说明；普通双击安装行为保持不变。

- [ ] **Step 1: 先验证当前配置已经满足标准静默参数**

运行：

```powershell
rg -n -C 2 "oneClick|perMachine|allowElevation|target: \"nsis\"" electron-builder.json5
```

预期包含：

```text
target: "nsis"
oneClick: false
perMachine: true
allowElevation: true
```

不把 `oneClick` 改成 `true`，因为当前需求是增加部署脚本能力，而不是改变普通安装向导。

- [ ] **Step 2: 在中英文构建文档中补充静默安装说明**

在各自的 Electron 构建章节、Windows 构建命令之后增加：

中文：

````markdown
#### Windows 静默安装

生成的 NSIS 安装包支持部署脚本静默安装：

```powershell
StickyCake_3.8.11.exe /S
```
````

如需指定安装目录，可使用 NSIS 参数：

```powershell
StickyCake_3.8.11.exe /S /D=C:\\Program Files\\StickyCake
```

当前安装器为全局安装（`perMachine`），静默安装可能触发 UAC。请使用管理员权限运行部署脚本，并根据脚本的进程退出码判断安装是否成功。普通双击安装仍显示安装向导。

````

英文使用同样的命令和参数，说明 `per-machine installation` 与 UAC。

- [ ] **Step 3: 运行 README 格式检查**

运行：

```powershell
npx prettier --check README.md README.zh-CN.md electron-builder.json5
````

预期：命令退出码为 `0`，没有格式错误。

- [ ] **Step 4: 构建并检查 effective config**

运行：

```powershell
npm run build:win
rg -n -C 2 "oneClick|perMachine|allowElevation|nsis" "release/StickyCake/3.8.11/builder-effective-config.yaml"
```

预期：Windows 安装器构建成功，effective config 中仍包含 `oneClick: false`、`perMachine: true` 和 `allowElevation: true`；安装包文件名为 `StickyCake_3.8.11.exe`。

- [ ] **Step 5: 提交安装文档变更**

运行：

```powershell
git add -- README.md README.zh-CN.md
git commit -m "docs: document Windows silent installation"
```

预期：只提交 Windows 静默安装使用说明。

---

### Task 4: 全量回归与交付检查

**Files:**

- Verify all files changed by Tasks 1–3

- [ ] **Step 1: 检查工作区和提交内容**

运行：

```powershell
git status --short
git log -4 --oneline
git diff HEAD~3..HEAD --stat
```

预期：没有未预期的构建产物或临时文件；变更只涉及消息样式、截图主进程/辅助测试、安装文档和计划要求的文件。

- [ ] **Step 2: 运行完整测试和静态检查**

运行：

```powershell
npm run lint
npx playwright test
npm run build
```

预期：三个命令均退出码为 `0`；lint 无新增错误；Playwright 全部通过；Vite/Electron 构建成功。

- [ ] **Step 3: 汇总人工验收证据**

记录以下结果后再报告完成：

1. 消息短文本、长文本、发送方/接收方及边界位置的操作栏截图或 UI 检查结果；
2. `OpenIM.log` 中 native screenshot success 或 thumbnail fallback 的完整记录；
3. 原生截图 PNG 的实际宽高；
4. NSIS 安装包路径、`/S` 静默安装命令和普通双击安装验证结果。

如果当前机器无法执行真实 Windows 安装器或没有可用桌面截图权限，报告中明确列出未验证项及其已完成的替代证据，不将其表述为已验证。
