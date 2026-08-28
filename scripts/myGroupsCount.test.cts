import assert = require("assert");
import fs = require("fs");
import path = require("path");

const myGroups = fs.readFileSync(
  path.join(process.cwd(), "src/pages/contact/myGroups/index.tsx"),
  "utf8",
);

assert.ok(
  myGroups.includes("if (selectGroup === GroupTypeEnum.JoinedGroup) {\n      return true;"),
  "joined groups should include groups created by the current user",
);
assert.ok(
  myGroups.includes("return group.creatorUserID === userID;"),
  "created groups should still be filtered by creator",
);

console.log("myGroupsCount tests passed");
