import assert = require("assert");
import { SessionType } from "@openim/wasm-client-sdk";

const {
  CHAT_SHAKE_CUSTOM_TYPE,
  CHAT_SHAKE_TEXT,
  buildShakeMessageData,
  canUseShake,
  getShakeMessageText,
  isShakeMessageData,
} = require("../src/utils/shakeMessage");

const normalConversation = {
  conversationID: "si_alice_bob",
  conversationType: SessionType.Single,
  userID: "alice",
};
const groupConversation = {
  conversationID: "sg_group-1",
  conversationType: SessionType.Group,
  groupID: "group-1",
};
const agentConversation = {
  conversationID: "si_bob_bot",
  conversationType: SessionType.Single,
  userID: "bot_demo",
};

const data = buildShakeMessageData();
assert.equal(JSON.parse(data).customType, CHAT_SHAKE_CUSTOM_TYPE);
assert.equal(isShakeMessageData(data), true);
assert.equal(getShakeMessageText(data, "张三"), "张三向您发送了一个抖动窗口");
assert.equal(CHAT_SHAKE_TEXT, "向您发送了一个抖动窗口");
assert.equal(canUseShake(normalConversation), true);
assert.equal(canUseShake(groupConversation), false);
assert.equal(canUseShake(agentConversation), false);
assert.equal(isShakeMessageData(JSON.stringify({ customType: 200 })), false);
assert.equal(getShakeMessageText("{bad json", "张三"), "");

console.log("shakeMessage tests passed");
