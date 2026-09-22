import assert = require("assert");

const { isForceUpdateRequired } = require("../electron/main/updateVersion");

assert.equal(isForceUpdateRequired("3.8.10", "3.8.11"), false);
assert.equal(isForceUpdateRequired("3.8.10", "3.8.12"), true);
assert.equal(isForceUpdateRequired("3.8.12", "3.8.10"), false);
assert.equal(isForceUpdateRequired("3.8.10", "3.8.10"), false);
assert.equal(isForceUpdateRequired("invalid", "3.8.12"), false);

console.log("forceUpdateVersion tests passed");
