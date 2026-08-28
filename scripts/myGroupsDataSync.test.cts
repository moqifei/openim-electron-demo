import assert = require("assert");
import fs = require("fs");
import path = require("path");

const contactStore = fs.readFileSync(
  path.join(process.cwd(), "src/store/contact.ts"),
  "utf8",
);
const myGroups = fs.readFileSync(
  path.join(process.cwd(), "src/pages/contact/myGroups/index.tsx"),
  "utf8",
);

assert.ok(
  contactStore.includes("IMSDK.getJoinedGroupList()"),
  "group contacts should refresh from the complete joined-group API",
);
assert.ok(
  myGroups.includes("getSpecifiedGroupsInfo"),
  "missing groups referenced by conversations should be recovered by group ID",
);
assert.ok(
  myGroups.includes("isNotInGroup"),
  "only conversations where the user is still in the group should be used as fallback",
);

console.log("myGroupsDataSync tests passed");
