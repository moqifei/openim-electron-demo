# 截图按钮动态快捷键提示设计

## 目标

截图操作栏悬停提示显示客户端当前配置的截图快捷键，而不是固定显示 `Ctrl+Shift+X`。设置页保存快捷键后，提示应立即更新，无需重启客户端。

## 方案

复用现有 Zustand 用户设置状态，将 `screenshotShortcut` 纳入 `appSettings`。主界面加载时从 Electron store 读取持久化配置；设置页保存成功后同时更新 Electron store 和 Zustand 状态；截图操作栏订阅该状态并使用共享格式化函数生成 tooltip 文案。

展示格式与设置页一致：`CommandOrControl`/`CmdOrCtrl` 显示为 `Ctrl`，快捷键各段使用 `+` 分隔，例如 `CommandOrControl+Alt+S` 显示为 `Ctrl + Alt + S`。

## 范围

- 修改用户设置类型和初始化逻辑。
- 修改个人设置页的快捷键读取、显示和保存同步逻辑。
- 修改截图操作栏 tooltip。
- 增加快捷键格式化和动态 tooltip 回归测试。
- 不修改 Electron 主进程快捷键注册、校验或持久化逻辑。
