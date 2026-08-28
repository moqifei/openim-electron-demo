import assert = require("assert");

const { isSandboxIPv4 } = require("../electron/main/updateEnvironment");

assert.equal(isSandboxIPv4("10.102.240.0"), true);
assert.equal(isSandboxIPv4("10.102.255.255"), true);
assert.equal(isSandboxIPv4("10.102.239.255"), false);
assert.equal(isSandboxIPv4("10.103.240.1"), false);
assert.equal(isSandboxIPv4("192.168.1.10"), false);
assert.equal(isSandboxIPv4("invalid-ip"), false);

const updateManage = require("fs").readFileSync(
  require("path").join(process.cwd(), "electron/main/updateManage.ts"),
  "utf8",
);
const debUpdateManage = require("fs").readFileSync(
  require("path").join(process.cwd(), "electron/main/debUpdateManage.ts"),
  "utf8",
);
assert.ok(updateManage.includes("autoUpdater.autoDownload = isSandbox ? false : config.autoDownload"));
assert.ok(updateManage.includes("showSandboxUpdateNotice"));
assert.ok(debUpdateManage.includes("if (isSandboxEnvironment())"));
assert.ok(debUpdateManage.includes("await showSandboxUpdateNotice();"));

console.log("updateSandbox tests passed");
