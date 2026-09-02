# 抖一抖功能设计

## 1. 目标

在现有 OpenIM Electron 客户端中增加单聊“抖一抖”功能：用户点击聊天工具栏中的“抖一抖”后，向当前单聊对象发送一个抖动窗口自定义消息；对方收到后，客户端自动显示并聚焦主窗口，打开对应对话页面，同时触发短暂的窗口抖动效果。

## 2. 范围与明确决策

- 仅支持单聊（`SessionType.Single`）。
- 群聊、工作群和智能体会话不显示“抖一抖”入口，也不响应抖动副作用。
- 复用现有的 `CustomMessage` 机制和 `customType = 901` 协议，不新增服务端接口或独立信令。
- 抖动消息保留在聊天消息历史中，并以通知消息形式展示，不显示为普通文本气泡。
- 发送方发送成功后本地窗口也触发一次抖动；接收方收到消息后同样触发一次抖动。
- 接收方若会话处于免打扰状态，不强制显示/聚焦窗口，也不触发窗口抖动；消息仍按现有消息接收流程处理。
- 窗口抖动时长沿用现有主进程默认值 1000ms。

## 3. 现有能力复用

项目当前已经具备以下基础能力：

- `src/utils/shakeMessage.ts` 定义抖动自定义消息类型、构造函数、识别函数和会话可用策略。
- `src/constants/im.ts` 中存在 `CustomType.ChatShake = 901`。
- `useSendMessage` 封装了本地消息入列、SDK 发送和失败状态更新。
- `src/layout/useGlobalEvents.tsx` 已能识别接收方的 `901` 消息，并查找会话、导航到聊天页、显示主窗口以及发送窗口抖动 IPC。
- Electron 主进程已有 `showMainWindow`、`shakeMainWindow` 和渲染层 `shakeMainWindowEffect` 的处理链路。
- `ChatContent` 和会话预览已将抖动消息作为通知消息并生成可读文本。

本次实现只补齐发送入口与发送逻辑，并对现有链路做针对性测试和必要的小范围修正。

## 4. 组件与职责

### 4.1 `SendActionBar`

- 读取当前会话。
- 调用 `canUseShake(currentConversation)` 判断是否显示按钮。
- 点击按钮时再次执行同一策略校验，防止会话在异步交互期间发生变化。
- 构造抖动自定义消息，并调用传入的 `sendMessage` 发送给当前会话用户。
- 发送失败沿用现有 `useSendMessage` 的失败状态处理，不新增独立重试或提示体系。

### 4.2 `shakeMessage` 工具

继续作为协议和策略的单一来源：

- `buildShakeMessageData()` 生成 `{ "customType": 901 }` JSON 数据。
- `canUseShake()` 限制单聊并排除智能体会话。
- `isShakeMessageData()` 识别接收/历史消息。

### 4.3 接收事件处理

继续由 `useGlobalEvents` 负责：

1. 收到 `CustomMessage` 后识别 `customType = 901`。
2. 忽略自己发送的抖动消息。
3. 根据消息获取对应会话；如果会话不在本地列表，则通过 SDK 查询。
4. 应用 `canUseShake` 和免打扰策略。
5. 显示/聚焦主窗口，更新当前会话并导航到 `/chat/:conversationID`。
6. 发送 `shakeMainWindow` IPC，由主进程负责原生窗口位移和渲染层动画。

发送方在消息发送流程完成后，也通过同一个 `shakeMainWindow` IPC 触发本地窗口抖动；接收方在收到消息后触发另一侧窗口抖动，因此双方各自抖动一次。

## 5. 数据流

```text
单聊工具栏点击
    -> canUseShake(currentConversation)
    -> buildShakeMessageData()
    -> IMSDK.createCustomMessage(...)
    -> useSendMessage({ message, recvID })
    -> 发送方本地 shakeMainWindow IPC
    -> OpenIM 服务端
    -> 对方 OnRecvNewMessages
    -> isShakeMessageData()
    -> 获取/定位会话
    -> showMainWindow + navigate(/chat/id)
    -> shakeMainWindow IPC
    -> Electron 主窗口抖动（发送方和接收方各自执行一次）
```

发送消息的具体 SDK 参数应遵循项目当前安装的 OpenIM SDK 类型和现有创建自定义消息的调用方式；若 SDK 版本没有专门的创建方法，则使用项目已支持的消息构造方式，保持 `contentType = MessageType.CustomMessage` 和 `customElem.data` 为抖动协议 JSON。

## 6. UI 设计

- 在现有 `SendActionBar` 工具项中增加一个与图片、文件、表情、截图、名片一致的操作入口。
- 使用现有图标/轻量图标风格，不新增复杂弹窗。
- 按钮标题为“抖一抖”；国际化资源若当前项目已有对应结构则同步中英文，否则优先保持现有中文 UI 约定并补充对应翻译键。
- 单聊不可用时不渲染按钮，而不是渲染后点击再提示。

## 7. 错误与边界处理

- 当前会话不存在、不是单聊、是智能体会话：按钮不显示，点击处理也直接返回。
- 接收消息无法定位会话：不执行窗口显示、路由跳转和抖动，避免把用户带到错误页面。
- 接收消息属于免打扰会话：不执行强制拉起和窗口抖动，保留现有消息/未读处理。
- SDK 创建或发送失败：由现有 `sendMessage` 逻辑标记发送失败；不新增重复的错误处理。
- 非法或无法解析的自定义数据：按普通未知自定义消息处理，不触发抖动。
- 多次快速接收：主进程已有计时器清理逻辑，新的抖动请求覆盖当前抖动，避免多个定时器叠加。

## 8. 测试与验收标准

### 自动化测试

- 发送入口使用共享 `canUseShake` 策略。
- 单聊显示“抖一抖”，群聊和智能体会话不显示。
- 点击处理会构造 `901` 自定义消息并发送给当前单聊对象。
- 接收处理会显示/切换到正确会话，并请求 1000ms 窗口抖动。
- 抖动通知文本和会话预览包含发送方昵称。

### 手工/构建验证

- 执行项目已有的相关测试命令。
- 执行 `npm run lint`。
- 执行 `npm run build`。
- 双客户端单聊验证：A 点击抖一抖，B 自动跳转到该聊天并抖动；A 不抖动。
- 群聊和智能体会话验证：工具栏不出现该入口。
- 免打扰单聊验证：消息可正常到达，但不强制拉起或抖动窗口。

## 9. 非目标

- 不实现群聊抖动。
- 不实现移动端或其他平台专属动画。
- 不新增服务端协议、推送通道或离线补偿机制。
- 不重构现有消息发送、会话路由和 Electron 窗口管理架构。
