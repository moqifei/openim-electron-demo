import assert = require("assert");
import fs = require("fs");
import path = require("path");

const debUpdateManage = fs.readFileSync(
  path.join(process.cwd(), "electron/main/debUpdateManage.ts"),
  "utf8",
);

assert.match(
  debUpdateManage,
  /await downloadDeb\(updateUrl, debPath\);/,
  "UOS updater should download the deb before installation",
);
assert.doesNotMatch(
  debUpdateManage,
  /verifySha512Digest|downloaded\.(base64|hex)|Downloaded deb size mismatch|Downloaded deb sha512 mismatch/,
  "UOS updater should not validate the downloaded deb after download",
);
assert.doesNotMatch(
  debUpdateManage,
  /createHash\("sha512"\)|hash\.update\(chunk\)/,
  "UOS updater should not calculate a SHA-512 digest during download",
);

console.log("debUpdateNoValidation tests passed");
