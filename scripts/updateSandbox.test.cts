import assert = require("assert");

const {
  isSandboxEnvironment,
  isSandboxIPv4,
} = require("../electron/main/updateEnvironment");

assert.equal(isSandboxIPv4("10.102.240.0"), true);
assert.equal(isSandboxIPv4("10.102.255.255"), true);
assert.equal(isSandboxIPv4("10.102.239.255"), false);
assert.equal(isSandboxIPv4("10.103.240.1"), false);
assert.equal(isSandboxIPv4("192.168.1.10"), false);
assert.equal(isSandboxIPv4("::ffff:10.102.240.12"), true);
assert.equal(isSandboxIPv4("invalid-ip"), false);
assert.equal(
  isSandboxEnvironment({
    eth0: [
      {
        address: "::ffff:10.102.240.12",
        family: "IPv6",
        internal: false,
        mac: "00:00:00:00:00:00",
        netmask: "ffff:ffff:ffff:ffff::",
        cidr: "::ffff:10.102.240.12/128",
      },
    ],
  }),
  true,
);

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
const availableHandler = updateManage
  .split('autoUpdater.on("update-available"')[1]
  .split('autoUpdater.on("update-not-available"')[0];
assert.match(availableHandler, /isSandboxEnvironment\(\)/);
assert.match(
  availableHandler,
  /autoUpdater\.autoDownload = isSandboxNow \? false : config\.autoDownload/,
);
const downloadedHandler = updateManage
  .split('autoUpdater.on("update-downloaded"')[1]
  .split('autoUpdater.on("error"')[0];
assert.match(
  downloadedHandler,
  /if \(isSandboxEnvironment\(\)\)[\s\S]*showSandboxUpdateNotice\(\)/,
);
assert.doesNotMatch(
  downloadedHandler,
  /if \(isSandbox\)\s*\{/,
  "download completion must re-check the current sandbox environment",
);
assert.ok(debUpdateManage.includes("if (isSandboxEnvironment())"));
assert.ok(debUpdateManage.includes("await showSandboxUpdateNotice();"));

console.log("updateSandbox tests passed");
