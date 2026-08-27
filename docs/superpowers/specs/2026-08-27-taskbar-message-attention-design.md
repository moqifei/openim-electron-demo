# 后台新消息任务栏提醒设计

## 目标

当应用窗口仍显示在 Windows 桌面任务栏、但当前处于后台且收到新消息时，让任务栏中的应用按钮进入系统橙色提醒状态，提示用户有待处理消息；用户点击任务栏切回应用后，清除任务栏提醒。

最小化到托盘时继续保留现有托盘图标和托盘消息提醒，不额外触发任务栏按钮提醒。

## 范围与边界

### 触发条件

新消息到达时，继续执行现有的桌面通知和托盘提醒逻辑，并额外请求任务栏关注状态。主进程根据真实窗口状态决定是否调用任务栏闪烁：

- 主窗口存在且未销毁；
- 主窗口可见；
- 主窗口未最小化；
- 主窗口当前未获得焦点。

只有满足全部条件时才触发 `BrowserWindow.flashFrame(true)`。

### 不触发条件

- 应用窗口当前已聚焦；
- 应用窗口已经隐藏到托盘；
- 应用窗口已经最小化；
- 主窗口不存在或已经销毁；
- 新消息处理处于同步/恢复阶段，不产生新的用户提醒；
- macOS/Linux 不强制模拟 Windows 橙色任务栏效果，保留平台原生行为。

最小化到托盘时，原有 `notifyIncomingMessage`、托盘图标提醒和托盘消息列表不变。

### 清除条件

主窗口收到 `focus` 事件时调用 `flashFrame(false)`，清除任务栏关注状态。用户点击任务栏、通过托盘打开应用或其他方式使主窗口获得焦点，都使用同一清除路径。

连续收到多条后台消息时保持现有任务栏提醒状态，不创建重复定时器，也不因单条消息处理结束而清除提醒；直到主窗口获得焦点才清除。

## 方案

在渲染进程已有的新消息处理链路中增加一个轻量的主进程 IPC 通知，例如 `incomingMessageAttention`。该 IPC 只表达“有需要关注的新消息”，不携带窗口状态，也不负责托盘提醒。

主进程新增对应监听器，调用窗口管理模块中的任务栏关注函数。窗口管理模块统一读取 `mainWindow.isVisible()`、`mainWindow.isMinimized()` 和 `mainWindow.isFocused()`，避免渲染进程状态与真实桌面状态产生竞态。

建议接口：

```ts
export const requestMainWindowAttention = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!isWin || !mainWindow.isVisible()) return;
  if (mainWindow.isMinimized() || mainWindow.isFocused()) return;
  mainWindow.flashFrame(true);
};
```

现有 `taskFlicker()` 可以复用或收敛为该入口，但必须补充主窗口存在性判断，不能在 `mainWindow` 为空时访问窗口方法。任务栏提醒的颜色由 Windows 系统主题和 Electron 原生行为决定，应用只请求关注状态，不自行绘制任务栏图标颜色。

## 数据流

```text
新消息
  ├─> notifyIncomingMessage
  │     └─> 保留桌面通知/托盘提醒
  └─> incomingMessageAttention IPC
        └─> 主进程读取窗口状态
              ├─> 可见 + 非最小化 + 未聚焦 + Windows
              │     └─> flashFrame(true)
              └─> 其他情况
                    └─> 不触发任务栏提醒

主窗口 focus 事件
  └─> flashFrame(false)
```

任务栏关注状态与现有托盘提醒状态相互独立：任务栏提醒只反映当前窗口是否在后台，托盘提醒继续反映是否存在待处理会话消息。

## 影响文件

- `electron/constants/index.ts`：增加渲染进程到主进程的任务栏关注 IPC 常量。
- `electron/main/ipcHandlerManage.ts`：注册任务栏关注 IPC，调用窗口管理模块。
- `electron/main/windowManage.ts`：实现真实窗口状态判断、任务栏关注和已有 focus 清除逻辑；修正 `taskFlicker()` 的空窗口保护（如复用该函数）。
- `src/layout/useGlobalEvents.tsx`：在符合现有新消息提醒条件的路径中发送任务栏关注 IPC，同时保留 `notifyIncomingMessage`。
- `scripts/taskbarMessageAttention.test.cts`：增加 IPC、触发条件和清除行为的源码契约测试。

不修改现有托盘图标闪烁、托盘消息面板、桌面通知内容和最小化到托盘逻辑。

## 测试与验收

### 自动化验证

- IPC 常量和主进程监听器使用同一个 `incomingMessageAttention` 通道。
- 新消息处理保留 `notifyIncomingMessage`，并发送任务栏关注 IPC。
- 主进程关注函数检查窗口存在性、Windows 平台、可见性、最小化状态和焦点状态。
- 后台可见窗口会调用 `flashFrame(true)`。
- 聚焦窗口、隐藏窗口、最小化窗口不会调用 `flashFrame(true)`。
- `focus` 事件调用 `flashFrame(false)`。
- 原有托盘提醒相关测试和行为不受影响。

### 手工验收

在 Windows 桌面完成以下检查：

1. 打开应用并保持窗口出现在任务栏。
2. 切换到其他应用，让本应用窗口处于后台但不要最小化到托盘。
3. 从另一客户端向本应用发送新消息。
4. 确认任务栏中的本应用按钮出现系统橙色提醒效果。
5. 点击本应用任务栏按钮切回客户端。
6. 确认橙色提醒恢复正常，不再继续提醒。
7. 将应用最小化到托盘后再次接收消息。
8. 确认托盘图标/托盘消息列表仍然提醒，但不依赖任务栏按钮提醒。

如果 Windows 版本、任务栏设置或系统主题导致 `flashFrame(true)` 的视觉颜色不同，应以“任务栏按钮进入系统关注/闪烁状态”为行为验收依据，不要求应用自行绘制固定色值。
