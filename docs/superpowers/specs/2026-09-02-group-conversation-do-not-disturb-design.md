# 群聊消息免打扰设计

## 目标

为普通群和工作群增加会话级“消息免打扰”设置。开启后仍接收消息并累计未读数，但不触发任务栏/托盘闪烁、Electron 通知弹窗或托盘消息弹窗；会话列表右侧显示免打扰标识。设置使用 OpenIM SDK 会话接口，从而同步到同一账号的其他客户端。

## 方案

使用 OpenIM SDK `ConversationItem.recvMsgOpt` 作为唯一状态来源：

- 开启使用 `MessageReceiveOptType.NotNotify`（值为 `2`）。
- 关闭使用 `MessageReceiveOptType.Normal`（值为 `0`）。
- 调用 `IMSDK.setConversation({ conversationID, recvMsgOpt })` 保存设置。
- 复用现有 `OnConversationChanged`/`OnNewConversation` 会话列表更新链路，支持其他客户端同步。
- 不使用本地缓存，也不修改群资料；免打扰是当前用户对会话的个人设置。

## UI 与行为

群聊设置面板在现有群资料设置区域增加一行开关。普通群和工作群均显示，开关值由当前会话的 `recvMsgOpt` 派生。请求失败时沿用现有错误反馈，避免产生错误的本地状态。

会话列表在右侧时间和未读数区域显示小型免打扰图标。图标只表示提醒关闭，不隐藏未读数，也不改变会话排序。

消息提醒在 `notifyIncomingMessage` 中统一过滤。免打扰会话直接跳过提醒 IPC；消息接收、会话更新、未读数、聊天内容和历史记录不受影响。抖一抖消息使用同一会话策略，不允许绕过免打扰触发窗口抖动或自动切换。

## 测试

增加源码契约测试和纯函数行为测试，覆盖 SDK 参数、普通群/工作群入口、免打扰提醒过滤、仍保留未读、列表标识以及会话变更状态同步。执行 TypeScript 类型检查、相关脚本测试和 ESLint。
