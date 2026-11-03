const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const organizationApi = read("src/api/organization.ts");
const userCard = read("src/pages/common/UserCardModal/index.tsx");

assert.match(organizationApi, /export const getADMemberByUserID/);
assert.match(organizationApi, /"\/ad\/member\/get"/);
assert.match(userCard, /getADMemberByUserID\(userID!\)/);
assert.doesNotMatch(userCard, /const adMember = adData\.members\?\.\[0\]/);

console.log("AD member profile lookup tests passed");
