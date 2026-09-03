# UOS 消息提醒、应用品牌、截图与图片另存为设计

## 背景与目标

信创 UOS 安装包当前存在四个用户可见问题：

1. 鼠标移动到右下角托盘图标时，UOS 主要显示托盘悬浮提示，只能看到应用名和发送人，缺少与 Windows 一致的消息弹窗和消息正文。
2. 安装后桌面快捷方式显示为 `StickyCake`，且快捷方式的执行路径与实际 Linux 可执行文件可能不一致，导致桌面图标无法启动。
3. 截图功能仍提供“截图时隐藏窗口”选项；后台使用全局快捷键时会主动显示并聚焦年糕，改变用户当前桌面状态。
4. 图片预览工具栏只有下载操作，没有允许用户选择目录和文件名的“另存为”操作。

本次目标是：

- 在 UOS 上由年糕自绘右下角消息弹窗，显示会话/发送人和消息正文，点击后打开对应会话；
- 统一 Linux 安装包、桌面快捷方式和启动器的执行标识，桌面显示名固定为“年糕”，双击可以启动；
- 删除截图隐藏配置，截图过程中不主动隐藏、显示或聚焦主窗口；
- 在图片预览下载按钮旁增加“另存为”，复用统一下载链路和原生保存对话框。

## 已确认的产品决策

### UOS 通知形式

采用年糕自绘的消息弹窗，不依赖 UOS 系统通知中心。原因是 UOS 发行版、桌面环境、主题和通知权限存在差异，而当前项目已经拥有跨平台自绘提醒窗口、托盘消息状态和会话点击入口。自绘弹窗可以保持 Windows 与 UOS 的内容和交互一致。

托盘图标闪烁和托盘悬浮会话面板继续保留，但它们是补充入口，不再承担 UOS 唯一的消息通知职责。

### Linux 品牌与执行文件

桌面和弹窗等用户可见名称统一为“年糕”。为避免中文文件名或内部历史名称导致 Linux 桌面环境无法启动，Linux 的实际可执行文件采用稳定的 ASCII 名称 `niangao`。安装目录、desktop 文件中的 `Exec`、卸载脚本和 bundled glibc 启动器均使用同一套实际打包信息，不再硬编码互相冲突的 `StickyCake`、`stickycake` 和 `OpenCorp-Base` 执行路径。

已有更新产物和 Windows 产物的 `StickyCake` 文件名保持不变，除非构建验证证明必须同步调整；本次需求只要求桌面显示名和 Linux 启动可用性。

## 现状与根因

### UOS 消息提醒

`electron/main/messageReminderManage.ts` 已实现右下角自绘提醒窗口，`electron/main/trayManage.ts` 已实现托盘悬浮消息面板。新消息链路会同时发送 `requestMainWindowAttention` 和 `notifyIncomingMessage`。

当前问题在于 UOS 用户实际看到的主要是托盘 tooltip/悬浮提示，提醒窗口在 UOS 窗口管理器下的显示时序和窗口级别不够稳定：

- 提醒窗口每次消息都重新 `loadURL`，只在 `did-finish-load` 后调用 `showInactive`，窗口第一次创建、重复加载和 UOS 窗口管理器的时序可能不一致；
- Linux 提醒窗口需要不抢焦点，但必须位于桌面通知层级并使用不透明背景，不能依赖透明窗口合成；
- 托盘 tooltip 使用 `app.getName()`，在品牌配置不一致时会把内部名称暴露给用户。

### Linux 安装后无法从桌面启动

`electron-builder.json5` 的 `productName` 已为“年糕”，但 Linux 自定义脚本仍包含多套旧标识：

- `scripts/linuxCreateDesktopShortcut.sh` 使用 `APP_NAME="StickyCake"`、`EXECUTABLE_NAME="stickycake"`；
- bundled glibc 默认安装目录仍是 `/opt/OpenCorp-Base`；
- 自定义 deb 脚本仍使用 `OpenCorp-Base` 作为包和输出标识；
- desktop 文件可能复制 electron-builder 生成的执行入口后，再被脚本改写为不存在的 `/opt/StickyCake/stickycake`。

这会造成 desktop 文件中的 `Name`、`Exec`、实际安装目录和真实可执行文件不一致。UOS 文件管理器显示的名称来自 desktop 文件，双击启动则完全依赖 `Exec` 可执行路径，因此会同时出现名称错误和无法打开。

### 截图隐藏行为

`SendActionBar` 保存 `screenshotHideWindow` 并通过下拉菜单让用户选择隐藏行为；`ChatFooter` 的全局截图事件会读取该设置；主进程 `triggerScreenshot` 会在快捷键触发时恢复、显示和聚焦主窗口。这与“当前窗口/当前桌面是什么就截什么”和“后台快捷键不把年糕弹出来”冲突。

### 图片另存为

`ChatContent` 的 `Image.PreviewGroup` 工具栏已使用统一 `downloadFileWithProgress` 下载原图，但目前只渲染下载图标。项目已经存在 `chooseDownloadPath` IPC 和 `filePath` 下载参数，文件消息的“另存为”已使用这条链路，因此图片只需要接入同一能力，不需要新增第二套保存实现。

## 设计方案

### 1. UOS 自绘消息弹窗

保留 `messageReminderManage.ts` 作为消息弹窗的唯一实现，并做以下最小调整：

- UOS 弹窗使用固定不透明背景、圆角和阴影，窗口属性包括 `skipTaskbar: true`、`alwaysOnTop: true`、`focusable: false`、`show: false`；
- 显示层级使用 UOS 可识别的桌面通知层级，保持 `showInactive()`，不激活年糕主窗口；
- 首次创建窗口后加载一个稳定的 HTML 页面；重复消息通过安全的页面更新方式刷新标题和正文，避免反复创建窗口或出现 `loadURL`/`did-finish-load` 竞态；
- 如果继续使用 data URL 加载，则必须保证每次调用都注册显示回调并在页面加载完成后显示，且窗口已销毁时不执行后续操作；
- 弹窗显示位置依据弹窗所在显示器的 `workArea` 计算，右下角保留固定边距，不覆盖系统任务栏；
- 标题使用会话显示名或发送人，正文使用现有消息摘要；HTML 文本继续进行转义，禁止消息内容注入标签或脚本；
- 弹窗点击通过已有 `openim-tray://conversation/<conversationID>` 链路打开会话，同时清除该会话提醒；
- 弹窗超时隐藏的行为保持现有 5 秒规则；托盘会话列表和“忽略全部”保持不变。

主进程收到 `notifyIncomingMessage` 后，继续先更新提醒状态，再显示自绘弹窗。`requestMainWindowAttention` 只负责 Windows 任务栏关注状态，不得作为 UOS 弹窗的替代路径。

### 2. Linux/UOS 品牌和启动入口

将用户可见名称和实际执行入口拆开并明确配置：

- `electron-builder.json5` 保持 `productName: "年糕"`；
- Linux 增加明确的 ASCII `executableName: "niangao"`；
- Linux desktop 文件的 `Name`、`GenericName`（如存在）和快捷方式显示文本为“年糕”；
- desktop 文件的 `Exec` 使用实际 `appInfo.executableName` 或与之等价的 `niangao`，并保留 `%U` 参数；
- Linux 安装目录统一为 `/opt/niangao`，或由 electron-builder 实际 `productFilename` 推导出的同一目录；脚本中只保留一套最终标识；
- `linuxCreateDesktopShortcut.sh` 和 `linuxRemoveDesktopShortcut.sh` 同步使用新的 desktop 文件名、安装目录、执行文件名和管理标记；
- 旧的 `OpenCorp-Base`/`opencorp-base`/`stickycake` desktop 文件只在确认属于本项目管理的情况下清理，不能删除用户自定义 desktop 文件；
- bundled glibc 的 `afterPackBundledGlibc.cjs` 使用 electron-builder 提供的实际可执行文件名和同一安装目录生成启动器，启动器调用对应的 `.real` 文件；
- `build-linux-deb.sh` 的自定义输出路径、包描述和最终文件名与当前 electron-builder 配置一致，不能把产物复制到不存在的 `release/Base` 或生成旧包名；
- 更新清单脚本只调整受 Linux 输出目录变化影响的路径，Windows 更新地址和已有产物命名不变。

验证时必须同时检查三层标识：

```text
桌面显示名：年糕
desktop Exec：/opt/niangao/niangao %U
实际文件：/opt/niangao/niangao
```

若 electron-builder 在当前版本生成的 Linux 主程序名称不是 `niangao`，实现必须以实际 `appInfo.executableName` 为准，并让 desktop 脚本读取或推导同一名称，不能凭猜测写死另一个名称。

### 3. 删除截图隐藏选项并保持后台截图静默

截图接口收敛为无参数调用：

```ts
startScreenshot(): Promise<{ dataUrl: string; isSelection: boolean } | null>
```

具体行为：

- 从 `SendActionBar` 删除截图图标右侧 Popover、隐藏/不隐藏状态、`localStorage` 读写和相关点击逻辑；
- 截图按钮直接调用 `onScreenshot()`；
- 全局快捷键事件直接复用 `ChatFooter` 的截图函数，不读取旧的 `screenshotHideWindow` 配置；
- `triggerScreenshot` 不再 `restore()`、`show()` 或 `focus()` 主窗口，只在主窗口存在时向渲染进程发送 `triggerScreenshot`；
- 主进程截图流程不再根据 `hideWindow` 隐藏/恢复主窗口；
- 当前主窗口前台时，捕获当前窗口所在显示器；主窗口后台、最小化或隐藏时，使用鼠标所在显示器，无法确定时回退主显示器；
- 原生选区截图仍使用现有 `electron-screenshots`，原生显示器截图仍优先使用 `node-screenshots`，thumbnail fallback、权限错误、PNG 尺寸日志和截图编辑流程保持不变；
- 后台快捷键启动截图时，截图覆盖层可以出现，但年糕主窗口不能因为快捷键而被显示或聚焦；截图完成或取消后也不改变主窗口原来的可见、最小化和焦点状态；
- 截图结果继续写入系统剪贴板，选区结果继续加入待发送图片队列，完整显示器截图继续进入现有预览编辑流程；
- 旧版本遗留的 `screenshotHideWindow` 本地存储值不再读取，也不需要主动迁移。

### 4. 图片预览增加“另存为”

在 `src/pages/chat/queryChat/ChatContent.tsx` 的 `toolbarRender` 中保留现有下载按钮，并在其右侧增加另存为按钮：

- 下载按钮不传 `filePath`，继续使用配置的默认下载目录；
- 另存为按钮先调用 `chooseDownloadPath`，传入根据原图 URL 或消息文件名推断的图片文件名；
- 用户取消对话框时直接返回，不显示下载失败；
- 用户确认路径后将 `filePath` 传给 `downloadFileWithProgress`，下载内容仍由统一 XHR 和进度逻辑处理；
- 原图 URL 优先使用 `sourcePicture.url`，不存在时回退 `snapshotPicture.url`；
- 文件名推断复用 `inferDownloadFileName`，至少支持 PNG、JPG/JPEG、GIF、BMP、WEBP；没有有效名称时按 MIME 或 URL 推断，最终回退为 `download`；
- 保存对话框继续由主进程根据最终扩展名生成默认类型过滤器，并保留“所有文件”选项；
- 另存为按钮增加可读的 title/aria-label，中文使用“另存为”，英文沿用现有国际化键；
- 不改变图片预览切换、关闭、缩放或消息列表行为。

## 数据流

### UOS 消息提醒

```text
新消息
  └─> useGlobalEvent.notifyIncomingMessage
       ├─> requestMainWindowAttention
       │    └─> Windows 任务栏关注（Linux 不强制执行）
       └─> notifyIncomingMessage
            └─> 主进程 showMessageReminder
                 ├─> 更新托盘会话状态/托盘图标
                 └─> 显示 UOS 右下角自绘弹窗
                      └─> 点击 openim-tray://conversation/... 打开会话
```

### 后台截图

```text
全局 Ctrl+Shift+X
  └─> 主进程 triggerScreenshot
       └─> 仅发送 triggerScreenshot 事件
            └─> ChatFooter.startScreenshot()
                 └─> 主进程捕获当前显示器
                      ├─> 原生选区/显示器截图
                      └─> fallback thumbnail
```

此流程中没有显示、恢复或聚焦主窗口的步骤。

### 图片另存为

```text
图片预览
  ├─> 下载
  │    └─> downloadFileWithProgress(url, fileName)
  │         └─> 默认下载目录
  └─> 另存为
       └─> chooseDownloadPath(fileName)
            └─> downloadFileWithProgress(url, fileName, filePath)
                 └─> 用户选择的路径
```

## 错误处理

- UOS 弹窗创建、加载或显示失败时记录主进程日志，但不能阻断托盘提醒、消息接收或主窗口运行；
- 消息标题和正文为空时使用现有“消息”兜底，不能生成空白或只显示内部 ID 的通知；
- Linux desktop 文件生成失败只记录安装脚本日志并保留安装流程返回状态，不能删除未确认由本项目管理的快捷方式；
- 桌面快捷方式路径必须是绝对路径，启动器和 `.real` 文件任一缺失时构建/安装验证失败；
- 截图取消、权限拒绝和原生模块失败继续沿用现有错误提示和 fallback 规则；
- 截图剪贴板写入失败不阻断待发送图片流程；
- 图片另存为用户取消不视为下载异常，不弹出失败提示；网络、HTTP 或写文件错误继续由现有下载错误提示处理；
- 另存为路径不应由渲染进程直接写入，所有 Electron 文件写入继续经过主进程 IPC。

## 文件边界

预计修改或新增以下文件，实际以实现阶段的源码检查为准：

- `electron/main/messageReminderManage.ts`：稳定 UOS 自绘弹窗的窗口属性、加载/显示时序和销毁保护；
- `electron/main/windowManage.ts`：移除全局截图触发时对主窗口的显示/恢复/聚焦；
- `electron/main/ipcHandlerManage.ts`：收敛截图 IPC 参数并依据当前显示器位置截图；
- `electron/main/shortcutManage.ts`：保持全局快捷键注册，确保失焦不会注销快捷键；
- `electron/preload/index.ts`：更新无参数截图暴露接口；
- `electron/constants/index.ts`：仅在现有通道不足时调整常量；
- `src/types/globalExpose.d.ts`：同步截图 API 类型；
- `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`：删除截图隐藏配置和下拉菜单；
- `src/pages/chat/queryChat/ChatFooter/index.tsx`：改为无参数截图，并保持剪贴板/待发送流程；
- `src/pages/chat/queryChat/ChatContent.tsx`：增加图片预览“另存为”；
- `electron-builder.json5`：明确 Linux executableName 和一致的打包标识；
- `scripts/linuxCreateDesktopShortcut.sh`：统一 desktop 显示名、执行路径和安装目录；
- `scripts/linuxRemoveDesktopShortcut.sh`：同步清理逻辑；
- `scripts/afterPackBundledGlibc.cjs`：使用实际 Linux 可执行文件生成 bundled glibc 启动器；
- `build-linux-deb.sh`：消除旧 `OpenCorp-Base`/`release/Base` 路径与当前配置的冲突；
- `scripts/*.test.cts`、`e2e/*.spec.ts`：增加通知、品牌/启动、截图静默和图片另存为回归测试；
- 如确有必要，补充 `README.zh-CN.md` 的 UOS 安装/启动验证说明。

不修改消息协议、服务器接口、图片上传接口、现有 Windows 安装向导、托盘消息数据结构和截图原生模块策略。

## 测试设计

实现必须遵循“先写失败测试，再写最小实现”的 TDD 顺序。

### 自动化测试

#### UOS 消息弹窗

- 检查 UOS 分支使用不透明背景、非激活显示、跳过任务栏和桌面通知层级；
- 检查消息提醒仍使用 `notifyIncomingMessage`，不依赖鼠标悬停托盘；
- 检查弹窗 HTML 对标题和正文做 HTML 转义，并包含会话点击链接；
- 检查提醒窗口加载完成后显示，且重复消息不会因为旧窗口已销毁而访问无效对象；
- 保留并运行现有托盘提醒和提醒状态测试。

#### Linux 品牌和启动

- 检查 `productName` 为“年糕”；
- 检查 Linux `executableName`、安装目录、desktop 文件 `Exec` 和卸载脚本使用同一执行标识；
- 检查 desktop `Name` 为“年糕”；
- 检查脚本不再生成 `/opt/OpenCorp-Base/opencorp-base` 或 `/opt/StickyCake/stickycake` 这样的旧执行路径；
- 检查 bundled glibc 启动器改名后仍调用实际 `.real` 文件；
- 使用 shell 静态检查或构建产物检查确认 desktop 文件和实际可执行文件同时存在。

#### 截图

- 检查截图按钮没有隐藏/不隐藏 Popover、`screenshotHideWindow` 读写和下拉箭头；
- 检查渲染层调用 `startScreenshot()` 时不传隐藏参数；
- 检查全局快捷键触发函数不调用 `show()`、`restore()` 或 `focus()`；
- 检查主进程截图 IPC 不再根据参数隐藏/恢复主窗口；
- 检查原有截图快捷键、剪贴板、PNG 尺寸和模块加载测试继续通过。

#### 图片另存为

- 检查图片预览工具栏同时包含下载和另存为操作；
- 检查另存为调用 `chooseDownloadPath` 并将用户路径传给统一下载函数；
- 检查下载按钮不调用路径选择；
- 检查取消保存时不调用下载或错误提示；
- 检查图片文件名和扩展名推断覆盖 PNG、JPG/JPEG、GIF、BMP、WEBP。

### 构建验证

- `npm run lint`
- `npm run build`
- 相关 Playwright/E2E 和 `scripts/*.test.cts` 测试
- Linux 构建时检查 `builder-effective-config.yaml`、desktop 文件、实际可执行文件和 `resources/app.asar`/`app.asar.unpacked` 内容；
- 若当前环境没有 UOS 桌面，则至少完成 Linux 打包静态检查，并明确记录需要在 UOS 真机进行的手工验证。

### 手工验收

#### UOS 消息提醒

1. 启动年糕并保持主窗口在后台但不退出。
2. 从另一个客户端发送新消息。
3. 确认右下角出现年糕自绘弹窗，显示发送人/会话名和消息正文。
4. 将鼠标移动到托盘图标，确认托盘悬浮面板仍可查看未读会话。
5. 点击右下角弹窗，确认年糕打开对应会话并清理该会话提醒。

#### UOS 安装与启动

1. 安装 deb 包。
2. 确认桌面显示名称为“年糕”。
3. 双击桌面图标，确认程序可以启动。
4. 从应用菜单启动，确认结果一致。
5. 卸载后确认本次安装创建的 desktop 文件被清理，旧用户自定义 desktop 文件不被误删。

#### 截图

1. 确认截图图标旁没有隐藏/不隐藏选项。
2. 前台使用截图按钮，确认截图内容为当前显示器内容。
3. 切换到其他窗口，在年糕后台使用 `Ctrl+Shift+X`，确认年糕主窗口不会跳到前台。
4. 完成截图或取消截图后，确认年糕原来的可见、最小化和焦点状态不被改变。
5. 确认截图仍可粘贴到外部编辑器，且可以继续发送到聊天。

#### 图片另存为

1. 点击聊天中的图片进入预览。
2. 确认工具栏有下载和另存为两个操作。
3. 点击下载，确认直接保存到默认下载目录。
4. 点击另存为，选择自定义目录和文件名，确认文件写入选定位置。
5. 取消另存为，确认不出现下载失败提示。

## 验收标准

- UOS 新消息出现年糕自绘右下角弹窗，弹窗包含发送人/会话名和正文，且不依赖托盘悬停；
- 托盘悬浮消息面板、托盘闪烁和点击打开会话能力保持可用；
- 安装后的桌面名称为“年糕”，桌面双击和应用菜单启动均成功；
- Linux desktop 文件 `Exec` 指向实际存在且可执行的程序；
- 截图没有隐藏/不隐藏选项，后台快捷键不会把年糕主窗口弹到前台；
- 截图剪贴板、截图编辑、截图发送和权限错误处理不回归；
- 图片预览同时支持默认下载和自定义路径另存为；
- 用户取消另存为不会被报告为下载失败；
- 相关自动化测试、lint 和构建验证通过；
- 工作区 diff 只包含本需求相关文件。

## 非目标

- 不接入 UOS 系统通知中心；
- 不重写托盘消息状态、消息协议或服务器通知接口；
- 不新增独立截图窗口，不更换截图原生模块，不改变截图分辨率和 fallback 策略；
- 不修改 Windows 普通安装向导和 Windows 产物文件名；
- 不把图片另存为实现为渲染进程直接写文件；
- 不升级 Electron、electron-builder 或截图依赖，除非构建验证证明现有版本无法完成上述目标。
