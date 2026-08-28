import assert = require("assert");

const {
  addReminderConversation,
  buildReminderPanelHtml,
  buildReminderTooltip,
  clearReminderConversation,
  clearReminderConversations,
  getReminderConversations,
} = require("../electron/main/messageReminderState");

clearReminderConversations();

addReminderConversation({
  conversationID: "single_1",
  title: "寒云",
  body: "111",
});
addReminderConversation({
  conversationID: "group_1",
  title: "项目群",
  body: "第二条消息",
});
addReminderConversation({
  conversationID: "single_1",
  title: "寒云",
  body: "更新后的消息",
});

assert.deepEqual(
  getReminderConversations().map((item: { conversationID: string; title: string; body: string }) => ({
    conversationID: item.conversationID,
    title: item.title,
    body: item.body,
  })),
  [
    { conversationID: "single_1", title: "寒云", body: "更新后的消息" },
    { conversationID: "group_1", title: "项目群", body: "第二条消息" },
  ],
);

assert.equal(buildReminderTooltip("年糕"), "年糕\n寒云\n项目群");

const panelHtml = buildReminderPanelHtml("年糕", [
  {
    conversationID: "single_1",
    title: "寒云 & 同事",
    body: "<script>111</script>",
    updatedAt: 1,
  },
]);
assert.ok(panelHtml.includes("openim-tray://conversation/single_1"));
assert.ok(panelHtml.includes("忽略全部"));
assert.ok(panelHtml.includes("寒云 &amp; 同事"));
assert.ok(panelHtml.includes("&lt;script&gt;111&lt;/script&gt;"));
assert.ok(!panelHtml.includes("<script>111</script>"));

clearReminderConversation("single_1");
assert.deepEqual(
  getReminderConversations().map((item: { conversationID: string }) => item.conversationID),
  ["group_1"],
);

clearReminderConversations();
assert.deepEqual(getReminderConversations(), []);
assert.equal(buildReminderTooltip("年糕"), "年糕");

console.log("messageReminderState tests passed");