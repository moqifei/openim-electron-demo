# UOS 托盘悬停提醒、Linux 品牌、截图与图片另存为设计（修订版）

## 修订说明

本文件替换同日期的上一版设计。上一版错误地将 UOS 消息提醒限定为托盘悬停展示，并将 Linux 实际可执行文件设计为 `niangao`；这两点不符合最新确认要求。

最新确认要求是：收到消息时，UOS 与 Windows 一样显示几秒钟的即时消息提醒，同时更新未读状态、托盘闪烁和 tooltip；鼠标移动到右下角托盘图标后，再显示 Windows 同款的多消息自绘面板。Linux 用户可见名称和实际可执行文件名为“年糕”，内部名称、安装路径和脚本标识使用 `stickycake`。

## 目标

1. 让 UOS 收到新消息时复用 Windows 当前的几秒钟即时消息提醒逻辑和样式。
2. 复用当前 Windows 的托盘悬停消息面板作为 UOS 的行为和样式基线：每个消息单独占一块区域，底部提供“忽略全部”。
3. 收到新消息时同时更新托盘未读状态、闪烁和 tooltip；鼠标进入或移动到托盘图标时显示完整消息面板，移开后延迟隐藏。
4. Linux/UOS 桌面显示名称统一为“年糕”，实际 Linux 可执行文件名统一为“年糕”，内部路径和标识统一使用 `stickycake`。
5. 删除截图隐藏/不隐藏选项，后台快捷键截图不主动弹出或聚焦年糕主窗口。
6. 在图片预览下载按钮旁增加支持自定义目录和文件名的“另存为”。

## Windows 行为基线

当前 `electron/main/trayManage.ts` 是 Windows 和 Linux 共用的托盘悬停实现，以下行为视为不可变基线：

- `mouse-enter` 和 `mouse-move` 调用同一个 `handleTrayHover`；
- 托盘面板只有存在未读会话时才显示；
- 面板使用 `buildReminderPanelHtml(app.getName(), trayAttentionConversations)` 生成内容；
- 面板宽度为 256，依据托盘图标位置和当前显示器 `workArea` 定位；
- 面板上方有空间时显示在图标上方，否则显示在图标下方或工作区边界内；
- 鼠标离开托盘和面板后延迟隐藏；鼠标仍在托盘/面板内时保持显示；
- 面板中的会话链接打开年糕并进入对应会话；“忽略全部”清除提醒；
- 面板窗口 `showInactive()` 显示，不主动抢占用户焦点；
- 面板样式、标题、正文、文本转义、圆角、边框、阴影、按钮和布局在 UOS 不另起一套。

实现阶段必须先保护上述 Windows 基线，再处理 UOS 差异。UOS 只允许在 Electron 窗口属性层面使用必要的兼容设置，例如不透明背景或 UOS 可识别的 always-on-top 层级；不得改变消息 HTML 和交互逻辑。

## Linux 命名映射

| 用途                                             | 固定值                    |
| ------------------------------------------------ | ------------------------- |
| 桌面显示名称                                     | `年糕`                    |
| Linux 实际可执行文件                             | `年糕`                    |
| Linux 安装目录                                   | `/opt/stickycake`         |
| Linux desktop 文件名                             | `stickycake.desktop`      |
| desktop 启动入口                                 | `/opt/stickycake/年糕 %U` |
| 内部脚本变量/日志前缀/路径标识                   | `stickycake`              |
| Windows 产品名、NSIS 行为和现有 Windows 产物命名 | 保持现状                  |

`StickyCake` 仅在 Windows 现有产物、更新兼容或当前代码明确要求的内部兼容位置保留。Linux 新增或修正的安装路径、desktop 文件名、包名、日志名和脚本变量不能使用 `OpenCorp-Base`、`opencorp-base` 或 `niangao`。

## 现状与根因

### 消息提醒

`electron/main/messageReminderManage.ts` 已有 Windows 风格的单条即时提醒窗口，默认持续 5 秒；`electron/main/trayManage.ts` 已有托盘悬停面板；`electron/main/messageReminderState.ts` 已负责未读会话状态和面板 HTML 生成；`useGlobalEvents.tsx` 在新消息时发送 `notifyIncomingMessage` 和任务栏提醒请求。

`electron/main/ipcHandlerManage.ts` 当前收到 `notifyIncomingMessage` 后会调用 `showMessageReminder`。UOS 当前的即时提醒窗口使用了 Linux 专属的背景、尺寸和窗口层级分支，视觉上与 Windows 不一致；托盘悬停时又可能只看到 UOS 的系统 tooltip，无法看到 Windows 基线中的多条完整消息。

修复重点是保留即时提醒和托盘悬停两个入口，但让它们共用同一套 Windows 视觉规则和提醒状态。收到消息必须调用现有即时提醒，同时更新状态；托盘悬停必须进入 `trayManage.ts` 的共用面板路径，不复制 HTML、定位算法或鼠标监控。

### Linux 启动

当前配置混用 `productName: "年糕"`、`StickyCake`、`stickycake` 和 `OpenCorp-Base`。Linux 自定义安装脚本把 desktop 文件的 `Exec` 写成 `/opt/StickyCake/stickycake`，但 builder 产物和安装目录可能使用另一套名称，因此 UOS 桌面显示名和实际执行路径不一致。

### 截图

`SendActionBar` 仍读取和保存 `screenshotHideWindow`；全局截图事件会读取该值；`windowManage.ts` 的 `triggerScreenshot` 会显示、恢复并聚焦主窗口；主进程截图 IPC 还接收 `hideWindow` 并在截图前后操作主窗口。

### 图片另存为

`ChatContent.tsx` 的图片预览工具栏已有统一下载操作，文件消息已使用 `chooseDownloadPath` 和 `downloadFileWithProgress({ filePath })` 实现“另存为”。图片预览只需复用该能力。

## 设计方案

### 1. 即时消息提醒与托盘悬停面板

- 保留 `messageReminderManage.ts` 的即时提醒职责：`notifyIncomingMessage` 收到合法消息后，调用 `showMessageReminder`，更新对应未读会话、托盘 tooltip 和闪烁，并显示持续 `5000ms` 的单条即时提醒；新消息到达时重置计时器，让最新消息可见几秒钟；点击即时提醒仍可打开对应会话。
- 移除 `messageReminderManage.ts` 中只针对 Linux/UOS 的 `isLinuxReminder`、深色背景、独立尺寸和不同 always-on-top 层级；即时提醒窗口的 HTML、CSS、尺寸、透明背景、`showInactive()` 和 5 秒隐藏行为使用 Windows 当前实现作为唯一基线。
- 保留 `trayManage.ts` 现有 `handleTrayHover`、`showTrayReminderPanel`、`startTrayPanelMouseMonitor`、面板边界计算和事件处理；Windows 与 UOS 的 `mouse-enter` 和 `mouse-move` 都调用同一个 `handleTrayHover`。
- UOS 鼠标进入/移动托盘图标时显示 `buildReminderPanelHtml` 生成的完整面板，显示条件仍为存在未读会话；每个会话使用独立 `.conversation` 区域，消息之间有分隔，面板底部固定 `.ignore-all` 的“忽略全部”。
- UOS 托盘悬停面板必须与 Windows 共用 HTML、CSS、面板尺寸、动态高度、定位算法、鼠标区域监控、点击打开会话、忽略全部、延迟隐藏和 `showInactive()`；只允许增加经 UOS 实机验证确有必要的 Electron 窗口兼容参数，不得改变视觉和交互契约。
- 新消息 IPC 仍然触发即时提醒，不在 IPC 层创建第二套 UOS HTML；即时提醒和托盘面板都通过 `messageReminderState.ts` 的同一份未读会话状态同步。
- 点击会话、忽略全部、鼠标从面板移回托盘、鼠标离开后的延迟隐藏、主窗口获得焦点清理提醒均保持现有行为。

自动化测试必须证明：UOS 的即时提醒仍由 `notifyIncomingMessage -> showMessageReminder` 触发；托盘完整面板位于 `mouse-enter`/`mouse-move -> handleTrayHover -> buildReminderPanelHtml` 事件链路；面板包含多个独立消息区域和底部“忽略全部”；Windows 现有 `trayHover.test.cts`、提醒状态测试继续通过。

### 2. Linux/UOS 品牌和启动入口

- `electron-builder.json5` 保持 `productName: "年糕"`，Linux 增加 `executableName: "年糕"`；
- Linux 安装目录、desktop 文件名、包内部标识和脚本变量统一为 `stickycake`；
- desktop 文件使用 `Name=年糕` 和 `Exec=/opt/stickycake/年糕 %U`；
- `scripts/linuxCreateDesktopShortcut.sh` 使用 `APP_DIR="/opt/stickycake"`、`EXECUTABLE_NAME="年糕"`、`SHORTCUT_NAME="stickycake.desktop"`，内部日志前缀保留 `stickycake`；
- `scripts/linuxRemoveDesktopShortcut.sh` 同步清理 `stickycake.desktop`，只删除本项目管理标记的旧快捷方式；
- `scripts/afterPackBundledGlibc.cjs` 以 `appInfo.executableName` 为首选实际文件名，默认执行文件为“年糕”，默认安装目录为 `/opt/stickycake`；启动器调用对应的 `年糕.real`；
- `build-linux-deb.sh` 的内部 package name、安装路径和控制文件使用 `stickycake`，输出目录和 Windows 现有产物保持兼容，不再写入 `OpenCorp-Base` 或旧 `release/Base` 路径；
- 不修改 Windows 的 `productName`、NSIS 配置、安装向导和既有 `StickyCake` 产物名；
- 打包验证必须检查实际生成的文件名，desktop `Exec` 必须指向该实际文件，不能仅依赖配置字符串。

### 3. 截图静默行为

将所有截图调用收敛为：

```ts
startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>
```

- 删除截图图标旁的隐藏/不隐藏 Popover、箭头和配置状态；
- 删除 `screenshotHideWindow` 的读取和写入；
- 全局快捷键只向渲染进程发送 `triggerScreenshot`，不调用主窗口 `show()`、`restore()` 或 `focus()`；
- 主进程截图不隐藏、不恢复、不聚焦主窗口；
- 截图目标优先使用当前聚焦窗口所在显示器，没有聚焦窗口时使用鼠标所在显示器，最后回退主显示器；
- 保留现有原生选区、`node-screenshots`、Windows DIP 坐标转换、thumbnail fallback、权限提示、PNG 日志、剪贴板写入和聊天待发送流程；
- 截图完成或取消后不改变主窗口原来的可见、最小化和焦点状态。

### 4. 图片预览另存为

- 保留现有图片下载按钮及默认下载目录行为；
- 在其旁边增加“另存为”按钮，使用现有 `placeholder.saveAs` 文案；
- 另存为先调用 `window.electronAPI.ipcInvoke("chooseDownloadPath", { fileName })`；
- 用户取消时直接返回，不调用下载，不显示错误；
- 用户确认后调用 `downloadFileWithProgress({ url, fileName, filePath: selectedPath, showProgressToast: true })`；
- 复用 `inferDownloadFileName` 和主进程保存过滤器，扩展 PNG、JPG/JPEG、GIF、BMP、WEBP；
- 不改变预览组切换、缩放、关闭和原图片下载行为。

## 数据流

### 托盘消息

```text
新消息
  └─> notifyIncomingMessage IPC
       └─> showMessageReminder
            ├─> 更新未读会话状态
            ├─> 托盘图标闪烁/tooltip 更新
            └─> 显示 5 秒 Windows 同款即时提醒

鼠标进入/移动托盘图标
  └─> handleTrayHover
       └─> buildReminderPanelHtml
            └─> showInactive 显示 Windows/UOS 共用面板

鼠标离开托盘和面板
  └─> 延迟隐藏
```

### 截图

```text
Ctrl+Shift+X
  └─> triggerScreenshot
       └─> 仅发送 triggerScreenshot 事件
            └─> ChatFooter.startScreenshot()
                 └─> startScreenshot()
                      └─> 捕获当前目标显示器
```

### 图片另存为

```text
图片预览
  ├─> 下载 ──> downloadFileWithProgress(url) ──> 默认目录
  └─> 另存为
       └─> chooseDownloadPath(fileName)
            └─> downloadFileWithProgress(url, fileName, selectedPath)
                 └─> 用户选择路径
```

## 错误处理

- 即时提醒创建、加载或显示失败时记录日志，但不阻断未读状态、托盘闪烁或 tooltip；
- 托盘面板创建、加载或显示失败时记录日志，但不阻断消息接收和托盘状态；
- UOS 不得因即时提醒或托盘面板兼容问题而回退到不同样式的临时 HTML；
- desktop 脚本只删除本项目管理标记或明确旧项目执行路径的文件；
- desktop `Exec`、安装目录、真实可执行文件三者不一致时构建验收失败；
- 截图取消、权限拒绝和原生模块失败沿用现有处理；
- 剪贴板写入失败不阻断截图待发送队列；
- 图片另存为取消不显示失败，网络/HTTP/写盘错误继续显示下载错误。

## 验收标准

- Windows 当前托盘悬停面板的 HTML、样式、尺寸、定位和交互没有回归；
- UOS 收到消息后显示几秒钟的 Windows 同款即时消息提醒，同时更新托盘图标、闪烁和 tooltip；
- UOS 鼠标进入/移动托盘图标后显示完整发送人/会话名和消息正文；多条消息分别位于独立区域，面板最下面有“忽略全部”；
- 鼠标移开托盘和面板后按现有延迟隐藏；
- UOS 面板点击可打开对应会话；
- 桌面显示“年糕”，Linux 实际可执行文件为“年糕”；
- Linux 内部安装路径和 desktop 文件名使用 `stickycake`，desktop 启动入口为 `/opt/stickycake/年糕 %U`；
- 桌面双击可以启动，应用菜单启动可以启动；
- 截图没有隐藏/不隐藏选项，后台快捷键不会把年糕主窗口弹到前台；
- 图片预览同时支持默认下载和自定义路径另存为；取消另存为不提示失败；
- 相关测试、lint、前端构建和可执行的 Linux 打包检查通过。

## 非目标

- 不接入 UOS 系统通知中心；
- 不为 UOS 创建独立于 Windows 的即时提醒或托盘面板 HTML、样式或业务逻辑；
- 不使用 `niangao` 作为 Linux 执行文件或内部路径；
- 不把 `OpenCorp-Base` 作为新的 Linux 安装标识；
- 不修改 Windows 安装向导、NSIS 参数、消息协议、服务器接口、图片上传接口或截图原生模块。
