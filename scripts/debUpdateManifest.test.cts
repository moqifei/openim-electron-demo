import assert = require("assert");
import crypto = require("crypto");
import fs = require("fs");
import os = require("os");
import path = require("path");
import yaml = require("js-yaml");

const packageJson = require("../package.json");
const { createDebUpdateManifest, writeDebUpdateManifest } = require("./writeDebUpdateManifest.cjs");

assert.match(
  packageJson.scripts["build:linux-glibc"],
  /electron-builder --linux deb --x64/,
);
assert.match(
  packageJson.scripts["build:linux-glibc"],
  /writeDebUpdateManifest/,
);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stickycake-deb-manifest-"));
const debPath = path.join(tempDir, "StickyCake_3.8.17_x64.deb");
const payload = Buffer.from("deb payload");
fs.writeFileSync(debPath, payload);

const run = async () => {
  const manifest = await createDebUpdateManifest(tempDir, "3.8.17");
  const expectedSha512 = crypto.createHash("sha512").update(payload).digest("base64");

  assert.deepEqual(manifest, {
    version: "3.8.17",
    files: [
      {
        url: "StickyCake_3.8.17_x64.deb",
        sha512: expectedSha512,
        size: payload.length,
      },
    ],
  });

  const manifestPath = await writeDebUpdateManifest(tempDir, "3.8.17");
  const written = yaml.load(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(written.version, "3.8.17");
  assert.deepEqual(written.files, manifest.files);
  assert.equal(manifestPath, path.join(tempDir, "latest-linux.yml"));
};

run()
  .then(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("debUpdateManifest tests passed");
  })
  .catch((error) => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
  });
