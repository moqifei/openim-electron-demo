# 聊天消息操作栏、原生截图与 Windows 静默安装设计

## 目标

修复客户端的三个问题：

1. 消息操作栏固定显示在消息气泡右上方，不遮挡消息正文，也不依赖消息左右侧的空白空间。
2. 修复服务器/打包环境截图退化为缩略图的问题，并增加能区分原生截图失败原因与 thumbnail fallback 的诊断日志。
3. 保持现有 Windows 普通安装向导，同时支持部署脚本使用 NSIS 标准静默参数 `/S` 安装。

本次不改变消息协议、组织结构接口、图片上传接口或现有截图编辑/待发送附件流程。

## 当前根因

### 消息操作栏

`src/pages/chat/queryChat/MessageItem/index.tsx` 将操作栏渲染在 `.menu-wrap` 内，样式通过 `left/right: calc(100% + ...)` 放在气泡侧面，并使用 `top: 50%` 垂直居中。消息行边界或聊天区域边界没有足够侧向空间时，操作栏会被遮挡；长消息时操作栏还会出现在正文中部附近，无法满足右上方定位要求。

### 截图

`electron/main/ipcHandlerManage.ts` 当前按以下顺序尝试截图：

1. `electron-screenshots` 原生选区；
2. `node-screenshots` 原生显示器截图；
3. `desktopCapturer.getSources(...).thumbnail` fallback。

第三步直接将 Electron `NativeImage.thumbnail` 转成 data URL。即使请求了较大的 `thumbnailSize`，该对象仍是 Electron 的缩略图结果，因此一旦原生路径失败，最终图片就会退化为低分辨率缩略图。

Windows 的 `display.bounds` 来自 Electron 的 DIP 坐标，而 `node-screenshots.Monitor.fromPoint()` 使用物理像素坐标。当前代码调用了 `screen.screenToDipPoint()`，坐标转换方向错误；应将 DIP 坐标转换为物理坐标。

当前日志只记录“原生路径失败，使用 fallback”，没有记录原生模块加载错误、显示器信息、请求尺寸、返回尺寸或最终 PNG 尺寸，无法定位服务器环境的具体失败点。

### Windows 安装

项目使用 electron-builder 的 NSIS target，当前配置为：

- `oneClick: false`：保留普通安装向导；
- `perMachine: true`：安装到所有用户范围；
- `allowElevation: true`：允许安装器请求管理员权限。

该 NSIS 安装器支持标准 `/S` 静默参数，不需要将普通安装器强制改成 one-click 模式。

## 设计方案

### 消息操作栏布局

保留现有 React hover 状态、操作回调和按钮内容，只调整布局：

- 操作栏继续由 `MessageItem` 在消息 hover 时渲染；
- 操作栏在 `.menu-wrap` 内绝对定位；
- 以消息内容区域右边缘为基准，设置 `right: 0`，并用负的 `top` 偏移放到消息气泡右上方；
- 不再按发送方/接收方将操作栏镜像到气泡左侧；
- 消息容器和消息包裹器保持 `overflow: visible`，避免操作栏被自身布局容器裁剪；
- 操作栏按钮继续阻止事件冒泡，避免点击按钮触发消息行选择；
- 不引入 body portal、窗口 resize 监听或额外的浮层定位状态。

此方案保持改动最小，且不改变操作项权限判断和 hover 行为。操作栏位于正文上方，不进入消息正文布局流，因此不会覆盖文本。

### 原生截图和诊断

在主进程中保留现有分层策略，但把原生显示器截图和结果诊断做成清晰的边界：

1. 获取当前窗口对应的 Electron display，并记录 display id、DIP bounds、scale factor。
2. 使用 `screen.dipToScreenPoint()` 将显示器中心从 DIP 转为物理像素，再传给 `Monitor.fromPoint()`。
3. 使用 `Monitor.captureImage()` 和 `image.toPng(true)` 获取原生 PNG。
4. 从 PNG 头部解析宽高，记录原生 monitor 宽高、PNG 宽高和 buffer 字节数。
5. 原生路径失败时记录完整错误信息，包括错误名称、消息、堆栈和模块解析路径；随后进入现有 fallback。
6. fallback 明确记录 `thumbnail fallback` 标记、请求的 thumbnailSize、选中的 source id/display id、NativeImage 是否为空以及 NativeImage 尺寸。
7. 返回结构继续使用 `{ dataUrl, isSelection }`，不改变渲染进程和截图编辑器的现有接口。

`asarUnpack: ["**/*.node"]` 保持不变。构建验证会检查 `node-screenshots` JavaScript 包和 Windows 平台 `.node` 文件均进入打包内容，避免原生模块在本地存在而在安装包中缺失。

PNG 尺寸解析使用纯函数，供单元/e2e 辅助测试验证。该测试只验证 PNG 字节到宽高的可靠解析，不依赖真实显示器或桌面权限。

### Windows 静默安装

保持现有 NSIS 配置，不切换安装器类型或普通安装行为：

- `oneClick: false`；
- `perMachine: true`；
- `allowElevation: true`。

在 Windows 安装文档中说明：

```powershell
StickyCake_3.8.11.exe /S
```

安装目录可通过 NSIS 的 `/D=C:\\目标目录` 参数指定。由于当前是 per-machine 安装，静默安装可能触发 UAC；部署脚本应使用管理员权限或处理 UAC 返回结果。普通双击仍显示现有安装向导。

构建验证检查 electron-builder 的 effective config 与目标产物；当前开发环境不是 Windows 时不执行安装器本身。

## 文件边界

- 修改 `src/pages/chat/queryChat/MessageItem/message-item.module.scss`：只调整操作栏布局相关规则，保留当前未合并内容。
- 视需要修改 `electron/main/ipcHandlerManage.ts`：修正 Windows 坐标转换、增加截图诊断并使用 PNG 尺寸辅助函数。
- 新增 `electron/utils/pngDimensions.ts`：解析 PNG 宽高的纯函数。
- 新增 `e2e/pngDimensions.spec.ts` 或沿用现有截图辅助测试文件：覆盖有效 PNG、无效/过短数据。
- 修改 `electron-builder.json5`：仅在验证需要时补充显式的 NSIS 配置或保持配置不变；不通过切换 `oneClick` 实现静默安装。
- 修改 `README.md` 或 `README.zh-CN.md`：说明 Windows 静默安装命令、`/D` 参数和 UAC 注意事项。
- 如当前构建入口缺少显式开发依赖，再同步修正 `package.json` 与 `package-lock.json`；不升级无关依赖。

当前处于 Git `UU` 状态的 `message-item.module.scss` 不执行覆盖式恢复，也不删除其中既有的未合并内容。

## 测试与验收

### 消息操作栏

- 运行 TypeScript/Vite 构建，确认 SCSS 和 JSX 编译通过；
- 通过现有聊天 UI 在短消息、长消息、发送方/接收方和聊天区域边界场景验证操作栏位置；
- 验收：操作栏的右边缘不超出消息内容容器，垂直位置在消息气泡上方，正文不被覆盖。

### 截图

- 先运行 PNG 尺寸辅助测试；
- 运行 TypeScript/Vite 构建；
- 检查构建产物中包含 `node-screenshots` 与对应 Windows `.node` 文件；
- 在可用 Windows 桌面环境中执行一次截图，检查日志包含原生路径、显示器尺寸和 PNG 尺寸；
- 若原生路径失败，日志必须明确显示失败原因和 thumbnail fallback 的实际尺寸；
- 验收：原生路径返回的 PNG 宽高等于捕获显示器的物理像素尺寸，而不是固定缩略图尺寸。

### 静默安装

- 运行 Windows NSIS 构建或检查已有 effective config；
- 确认 `oneClick: false`、`perMachine: true`、`allowElevation: true`；
- 在 Windows 部署环境执行 `Setup.exe /S`，确认不显示安装向导并完成安装；
- 普通双击安装仍显示安装向导。

## 非目标

- 不把操作栏改成 body portal 浮层；
- 不移除截图 fallback；
- 不改变截图确认后的待发送附件行为；
- 不修改消息协议、SDK 数据结构或图片上传接口；
- 不升级 Electron、electron-builder 或截图依赖版本，除非构建验证证明现有版本无法打包原生模块。
