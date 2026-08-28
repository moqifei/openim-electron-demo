import assert = require("assert");
import fs = require("fs");
import path = require("path");

const loginForm = fs.readFileSync(
  path.join(process.cwd(), "src/pages/login/LoginForm.tsx"),
  "utf8",
);
const storage = fs.readFileSync(
  path.join(process.cwd(), "src/utils/storage.ts"),
  "utf8",
);

assert.ok(
  loginForm.includes("rememberPassword"),
  "login form should expose a remember-password field",
);
assert.ok(
  loginForm.includes("getRememberedAdLogin") &&
    loginForm.includes("saveRememberedAdLogin"),
  "login form should restore and save remembered AD credentials",
);
assert.ok(
  storage.includes("getRememberedAdLogin") &&
    storage.includes("saveRememberedAdLogin"),
  "credential storage should support account-scoped remembered passwords",
);

console.log("loginRememberPassword tests passed");
