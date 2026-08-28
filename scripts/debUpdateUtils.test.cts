import assert = require("assert");
import { createHash } from "crypto";

const {
  getDebUpdateFile,
  getDebManifestUrl,
  isNewerVersion,
  verifySha512,
} = require("../electron/main/debUpdateUtils");

const manifest = {
  version: "3.8.16",
  files: [
    {
      url: "StickyCake_3.8.16_arm64.deb",
      sha512: "arm64-sha",
      size: 10,
    },
    {
      url: "StickyCake_3.8.16_amd64.deb",
      sha512: "amd64-sha",
      size: 20,
    },
  ],
};

assert.equal(
  getDebManifestUrl("https://updates.example.com/im"),
  "https://updates.example.com/im/latest-linux.yml",
);
assert.equal(
  getDebManifestUrl("https://updates.example.com/im/", "channel-linux.yml"),
  "https://updates.example.com/im/channel-linux.yml",
);
assert.deepEqual(getDebUpdateFile(manifest, "x64"), manifest.files[1]);
assert.deepEqual(getDebUpdateFile(manifest, "arm64"), manifest.files[0]);
assert.equal(isNewerVersion("3.8.15", "3.8.16"), true);
assert.equal(isNewerVersion("3.8.16", "3.8.16"), false);
assert.equal(isNewerVersion("3.8.16", "3.8.17-beta.1"), false);
assert.equal(isNewerVersion("3.8.16", "3.8.17-beta.1", true), true);

const payload = Buffer.from("deb update payload");
const digest = createHash("sha512").update(payload).digest("base64");
assert.equal(verifySha512(payload, digest), true);
assert.equal(verifySha512(payload, "invalid-sha512"), false);

assert.throws(
  () => getDebUpdateFile({ version: "3.8.16", files: [] }, "x64"),
  /No deb update file matched/,
);

console.log("debUpdateUtils tests passed");
