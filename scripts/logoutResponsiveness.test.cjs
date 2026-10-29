const assert = require("assert");
const fs = require("fs");
const path = require("path");

const userStore = fs.readFileSync(
  path.join(process.cwd(), "src/store/user.ts"),
  "utf8",
);

assert.ok(userStore.includes("await logoutSession()"));
assert.ok(!userStore.includes("await IMSDK.logout()"));
assert.ok(
  userStore.includes("void IMSDK.logout().catch"),
  "SDK logout must not delay local logout after server-side token revocation",
);

console.log("logout responsiveness tests passed");
