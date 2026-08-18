# 截图按钮快捷键提示设计

## 目标

鼠标悬停在聊天输入区的截图图标上时，显示 `截图（Ctrl+Shift+X）`，帮助用户发现截图快捷键。

## 方案

在 `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx` 的截图图片元素上增加静态 `title` 属性。截图点击行为、全局快捷键注册、截图配置下拉菜单和国际化逻辑均保持不变。

## 验证

复用 `e2e/screenshotData.spec.ts` 中已有的源码回归测试，确认截图按钮包含精确的 `title` 文案；再运行项目 lint 和前端构建，确认没有引入类型或语法问题。
