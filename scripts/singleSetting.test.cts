import assert = require("assert");
import fs = require("fs");
import path = require("path");

const filePath = path.join(
  process.cwd(),
  "src/pages/chat/queryChat/SingleSetting/index.tsx",
);
const source = fs.readFileSync(filePath, "utf8");

assert.ok(!source.includes("placeholder.moveBlacklist"));
assert.ok(!source.includes("IMSDK.addBlack"));
assert.ok(!source.includes("IMSDK.removeBlack"));

if (source.includes("modal.confirm")) {
  assert.ok(
    /import\s+\{\s*modal\s*\}\s+from\s+["']@\/AntdGlobalComp["'];/.test(source),
    "SingleSetting uses modal.confirm and must import modal",
  );
}

console.log("singleSetting tests passed");
