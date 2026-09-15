const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const chooseBox = read("src/pages/common/ChooseModal/ChooseBox/index.tsx");
const forwardModal = read("src/pages/chat/queryChat/ForwardModal.tsx");
const forwardSearchPath = "src/pages/common/ChooseModal/ChooseBox/ForwardSearchList.tsx";

assert.ok(fs.existsSync(path.join(process.cwd(), forwardSearchPath)));

const forwardSearchList = read(forwardSearchPath);

assert.match(chooseBox, /forwardSearch\?: boolean/);
assert.match(chooseBox, /<ForwardSearchList/);
assert.match(forwardModal, /forwardSearch/);
assert.match(forwardSearchList, /inputRef\.current\?\.focus/);
assert.match(forwardSearchList, /searchADMembers/);
assert.match(forwardSearchList, /searchAgents/);
assert.match(forwardSearchList, /groupList/);
assert.match(forwardSearchList, /filterByFuzzyPinyin\(mapMembers\(memberResponse\), query\)/);
assert.match(forwardSearchList, /filterByFuzzyPinyin\(mapAgents\(agentResponse\), query\)/);
assert.match(
  forwardSearchList,
  /const isPinyinSearch = \/\^\[a-zA-Z0-9\]\+\$\/\.test\(query\)/,
);
assert.match(forwardSearchList, /searchADMembers\(\{\s*keyword: "",/);
assert.match(forwardSearchList, /searchAgents\("", \{\s*pageNumber: 1, showNumber: 1000 \}\)/);
assert.match(forwardSearchList, /itemClick=\{checkClick\}/);
assert.match(
  forwardSearchList,
  /if \(!query\) \{\s*requestIdRef\.current \+= 1;/,
);
assert.match(chooseBox, /!forwardSearch[\s\S]*menuList\.map/);

console.log("forward direct search behavior tests passed");
