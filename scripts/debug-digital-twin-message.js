/**
 * 数字分身消息调试脚本
 * 
 * 在 Electron DevTools Console 中运行此脚本，诊断为什么数字分身消息
 * 没有正确显示真实回复文本。
 * 
 * 使用方法：
 * 1. 打开 Electron 客户端 DevTools (F12)
 * 2. 切换到 Console 标签
 * 3. 复制粘贴整个脚本内容并回车运行
 * 4. 查看输出结果
 */

// ============================================================
// 第一部分：获取最近的消息列表
// ============================================================

/**
 * 从 React 组件树中获取最近的会话消息列表组件状态
 * 这需要 Electron 客户端暴露全局调试钩子
 */
function getRecentMessages() {
  // 尝试从 React DevTools 获取
  const reactRoot = document.getElementById('root');
  if (!reactRoot) {
    return { error: '找不到 #root 元素' };
  }

  // 尝试获取 React 组件实例（取决于客户端实现）
  const fakeKey = Object.keys(reactRoot).find(key => 
    key.startsWith('__reactFiber') || key.startsWith('$react')
  );
  
  if (!fakeKey) {
    return { error: '无法访问 React 组件状态，请使用 React DevTools 插件' };
  }

  // 返回 fiber node（可能需要手动检查）
  return {
    hint: '请打开 React DevTools，找到 MessageList 组件，检查 messages 数组',
    sampleMessage: null, // 需要你手动复制一条消息的结构
  };
}

// ============================================================
// 第二部分：手动测试消息解析逻辑
// ============================================================

/**
 * 模拟后端发送的消息结构
 */
const MOCK_BACKEND_MESSAGE = {
  sendID: '5360170321',
  content: '收到，测试消息没问题 ✅ 有什么需要帮忙的随时说～',
  ex: JSON.stringify({
    openim_ext_type: 'digital_twin',
    version: 1,
    ownerUserID: '5360170321',
    triggerSendID: '9414555381',
    triggerServerMsgID: '1593d0552b27a75cee4e0138c693e6cf',
    triggerClientMsgID: '992bc9dadb6ed685e7eb8b6092f3228f',
    generatedBy: 'chat.digitaltwin.mvp',
    replySource: 'http_generator',
    createdAt: 1782734590405,
    openim_digital_twin_trace: {
      source: 'orange_dispatcher',
      protocolSource: 'openclaw_channel_tool',
      finalizeSource: 'openclaw_channel_tool',
      metadata: {
        accountId: 'digital_twin:5360170321',
        agentId: 'openim1',
        clientMsgID: '992bc9dadb6ed685e7eb8b6092f3228f',
        operationID: '069ec6df-28d6-4abd-b9d8-a0683fcc1923',
        ownerUserID: '5360170321',
        protocol: 'openim_digital_twin_http_task',
        senderUserID: '9414555381',
        serverMsgID: '1593d0552b27a75cee4e0138c693e6cf',
        source: 'orange_dispatcher',
        workspacePath: '/Users/moqifei/.orange/sandboxes/openim1/openim/digital_twin/5360170321',
        workspaceScope: 'digital_twin_owner'
      }
    }
  }),
  contentType: 101, // TextMessage
  textElem: {
    content: '收到，测试消息没问题 ✅ 有什么需要帮忙的随时说～'
  }
};

/**
 * 测试 isDigitalTwinMessage 逻辑
 */
function testIsDigitalTwinMessage(message) {
  console.group('🔍 测试 isDigitalTwinMessage');
  
  // 解析 ex 字段
  let exParsed;
  try {
    exParsed = typeof message.ex === 'string' ? JSON.parse(message.ex) : message.ex;
  } catch (e) {
    console.error('❌ ex 字段解析失败:', e);
    console.end();
    return false;
  }

  console.log('📦 解析后的 ex:', JSON.stringify(exParsed, null, 2));
  
  const hasDigitalTwinExt = exParsed?.openim_ext_type === 'digital_twin';
  console.log(`✅ openim_ext_type === 'digital_twin': ${hasDigitalTwinExt}`);
  
  console.end();
  return hasDigitalTwinExt;
}

/**
 * 测试 extractDigitalTwinText 逻辑
 */
function testExtractText(message) {
  console.group('📝 测试 extractDigitalTwinText');
  
  const results = {};
  
  // 1. 检查 textElem
  if (message.textElem && typeof message.textElem === 'object') {
    results.textElemContent = message.textElem.content || '(空)';
  } else {
    results.textElem = '(不存在或不是对象)';
  }
  
  // 2. 检查 content 字段
  if (typeof message.content === 'string') {
    results.contentRaw = message.content;
    results.contentLength = message.content.length;
  } else {
    results.contentRaw = JSON.stringify(message.content);
  }
  
  // 3. 检查 ex 字段
  if (message.ex) {
    try {
      const exParsed = typeof message.ex === 'string' ? JSON.parse(message.ex) : message.ex;
      results.hasEx = true;
      results.exKeys = Object.keys(exParsed);
      results.hasTrace = !!exParsed.openim_digital_twin_trace;
      results.hasProtocolSource = !!exParsed.openim_digital_twin_trace?.protocolSource;
    } catch (e) {
      results.exParseError = e.message;
    }
  }
  
  console.log('📊 测试结果:', results);
  console.log('\n💡 建议：');
  console.log('  - 如果 textElemContent 有值 → 检查 extractDigitalTwinText 函数');
  console.log('  - 如果 contentRaw 有值 → 检查 content 字段访问方式');
  console.log('  - 如果 hasProtocolSource 为 true → isDigitalTwinMessage 应该通过');
  
  console.end();
  return results;
}

// ============================================================
// 第三部分：执行测试
// ============================================================

console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #7c3aed; font-weight: bold');
console.log('%c🧪 数字分身消息调试工具', 'color: #7c3aed; font-weight: bold; font-size: 16px');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #7c3aed; font-weight: bold');

console.log('\n📋 使用方式：\n');
console.log('  方式 1：测试模拟数据（立即执行）');
console.log('    testMockMessage()\n');
console.log('  方式 2：测试真实消息（需要你复制消息结构）');
console.log('    1. 在 React DevTools 中找到一条数字分身消息');
console.log('    2. 复制它的完整结构');
console.log('    3. 运行 testRealMessage(yourMessageObject)\n');

/**
 * 测试模拟消息
 */
function testMockMessage() {
  console.clear();
  console.log('%c🎭 测试模拟的后端消息结构', 'color: #059669; font-weight: bold; font-size: 14px');
  
  const isDT = testIsDigitalTwinMessage(MOCK_BACKEND_MESSAGE);
  console.log(`\n✅ isDigitalTwinMessage: ${isDT}\n`);
  
  const textResults = testExtractText(MOCK_BACKEND_MESSAGE);
  
  console.log('\n%c🎯 结论：', 'color: #dc2626; font-weight: bold; font-size: 14px');
  if (isDT && textResults.textElemContent !== '(空)') {
    console.log('  ✅ 消息能被识别为数字分身');
    console.log('  ✅ textElem.content 有值:', textResults.textElemContent);
    console.log('  💡 问题不在消息结构，而在客户端渲染逻辑');
  } else if (isDT && textResults.textElemContent === '(空)') {
    console.log('  ✅ 消息能被识别为数字分身');
    console.log('  ❌ textElem.content 为空');
    console.log('  💡 检查后端发送时 textElem 是否正确填充');
  } else {
    console.log('  ❌ 消息不能被识别为数字分身');
    console.log('  💡 检查 ex 字段格式或 DIGITAL_TWIN_EXT_TYPE 常量');
  }
}

/**
 * 测试真实消息（需要你传入消息对象）
 */
function testRealMessage(messageObj) {
  console.clear();
  console.log('%c📬 测试真实消息', 'color: #059669; font-weight: bold; font-size: 14px');
  
  const isDT = testIsDigitalTwinMessage(messageObj);
  console.log(`\n✅ isDigitalTwinMessage: ${isDT}\n`);
  
  const textResults = testExtractText(messageObj);
  
  return { isDigitalTwin: isDT, textResults };
}

// 暴露到全局，方便在 Console 中调用
window.testMockMessage = testMockMessage;
window.testRealMessage = testRealMessage;
window.MOCK_BACKEND_MESSAGE = MOCK_BACKEND_MESSAGE;

console.log('%c✨ 就绪！运行 testMockMessage() 开始测试', 'color: #059669; font-weight: bold');
console.log('%c  或运行 testRealMessage(yourMessage) 测试真实消息\n', 'color: #6b7280');
