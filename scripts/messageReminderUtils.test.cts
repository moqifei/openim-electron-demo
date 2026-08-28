import assert = require("assert");

const { buildReminderHtml, normalizeReminderText } = require("../src/utils/messageReminder");

assert.equal(
  normalizeReminderText("  第一行\n第二行  "),
  "第一行 第二行",
);

const html = buildReminderHtml({
  title: '群 & 会话',
  body: '<script>alert(1)</script>\n第二行',
});

assert.ok(html.includes("群 &amp; 会话"));
assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt; 第二行"));
assert.ok(!html.includes("<script>alert(1)</script>"));

console.log("messageReminderUtils tests passed");
