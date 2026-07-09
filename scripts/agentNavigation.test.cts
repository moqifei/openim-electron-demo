import assert = require("assert");

const { getMainNavConfig } = require("../src/layout/LeftNavBar/navConfig");

const items = getMainNavConfig({
  chatTitle: "消息",
  contactTitle: "通讯录",
});

const paths = items.map((item: { path: string }) => item.path);
const digitalTwinIndex = paths.indexOf("/digital-twin");
const agentsIndex = paths.indexOf("/agents");

assert.notEqual(digitalTwinIndex, -1);
assert.equal(agentsIndex, digitalTwinIndex + 1);
assert.equal(items[agentsIndex].title, "智能体");

console.log("agentNavigation tests passed");
