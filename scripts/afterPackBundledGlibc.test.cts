import assert = require("assert");
import fs = require("fs");
import path = require("path");
import vm = require("vm");

const scriptPath = path.join(process.cwd(), "scripts/afterPackBundledGlibc.cjs");
const source = fs.readFileSync(scriptPath, "utf8");

const sandbox = {
  module: { exports: {} },
  exports: {},
  require,
  process,
  console,
  __dirname: path.dirname(scriptPath),
  __filename: scriptPath,
  Buffer,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};

vm.runInNewContext(
  `${source}\nmodule.exports.__test__ = { getLinuxInstallDir };`,
  sandbox,
  { filename: scriptPath },
);

const { getLinuxInstallDir } = sandbox.module.exports.__test__;

assert.equal(
  getLinuxInstallDir({
    productFilename: "年糕",
    productName: "StickyCake",
    name: "StickyCake",
  }),
  "/opt/StickyCake",
);

assert.equal(
  getLinuxInstallDir({
    productFilename: "年糕",
    productName: "年糕",
    name: "年糕",
  }),
  "/opt/StickyCake",
);

console.log("afterPackBundledGlibc install-dir tests passed");
