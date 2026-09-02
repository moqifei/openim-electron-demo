import assert = require("assert");
import fs = require("fs");
import path = require("path");

const electronBuilderConfig = fs.readFileSync(
  path.join(process.cwd(), "electron-builder.json5"),
  "utf8",
);
assert.ok(
  electronBuilderConfig.includes('"src/config/serverEnvironments.json"'),
  "packaged app must include the server environment config used by the main process",
);

const {
  isSandboxEnvironment,
  isSandboxIPv4,
} = require("../electron/main/updateEnvironment");

assert.equal(isSandboxIPv4("10.138.160.0"), true);
assert.equal(isSandboxIPv4("10.138.175.255"), true);
assert.equal(isSandboxIPv4("10.138.159.255"), false);
assert.equal(isSandboxIPv4("10.138.176.0"), false);
assert.equal(isSandboxIPv4("10.139.160.1"), false);
assert.equal(isSandboxIPv4("192.168.1.10"), false);
assert.equal(isSandboxIPv4("::ffff:10.138.160.12"), true);
assert.equal(isSandboxIPv4("invalid-ip"), false);

const sandboxNetworkInterfaces = {
  eth0: [
    {
      address: "10.138.160.12",
      family: "IPv4",
      internal: false,
      mac: "00:00:00:00:00:00",
      netmask: "255.255.240.0",
      cidr: "10.138.160.12/20",
    },
  ],
};

const runSandboxChecks = async () => {
  let probeArgs;
  const canReachTestIm = async (...args) => {
    probeArgs = args;
    return true;
  };

  assert.equal(
    await isSandboxEnvironment({
      networkInterfaces: sandboxNetworkInterfaces,
      canReachTestIm,
    }),
    true,
  );
  assert.deepEqual(probeArgs, ["openimserver.qa.bx", [20001, 10001], 1200]);

  assert.equal(
    await isSandboxEnvironment({
      networkInterfaces: sandboxNetworkInterfaces,
      canReachTestIm: async () => false,
    }),
    false,
  );

  assert.equal(
    await isSandboxEnvironment({
      networkInterfaces: {
        eth0: [{ ...sandboxNetworkInterfaces.eth0[0], address: "10.138.159.255" }],
      },
      canReachTestIm: async () => true,
    }),
    false,
  );
};

runSandboxChecks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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
assert.match(updateManage, /await isSandboxEnvironment\(\)/);
const availableHandler = updateManage
  .split('autoUpdater.on("update-available"')[1]
  .split('autoUpdater.on("update-not-available"')[0];
assert.match(availableHandler, /isSandboxEnvironment\(\)/);
assert.match(
  availableHandler,
  /autoUpdater\.autoDownload = isSandboxNow \|\| isManualCheck \? false : config\.autoDownload/,
);
const downloadedHandler = updateManage
  .split('autoUpdater.on("update-downloaded"')[1]
  .split('autoUpdater.on("error"')[0];
assert.match(
  downloadedHandler,
  /if \(await isSandboxEnvironment\(\)\)[\s\S]*showSandboxUpdateNotice\(\)/,
);
assert.doesNotMatch(
  downloadedHandler,
  /if \(isSandbox\)\s*\{/,
  "download completion must re-check the current sandbox environment",
);
assert.ok(debUpdateManage.includes("if (await isSandboxEnvironment())"));
assert.ok(debUpdateManage.includes("await showSandboxUpdateNotice();"));

console.log("updateSandbox tests passed");
