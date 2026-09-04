import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(process.cwd(), "electron/main/debUpdateManage.ts"),
  "utf8",
);

assert.match(
  source,
  /execFile\(\s*"xdg-open",\s*\[debPath\]/s,
  "UOS updates should open the downloaded deb with xdg-open",
);
assert.doesNotMatch(
  source,
  /shell\.openPath\(debPath\)/,
  "UOS updates should not use Electron shell.openPath for the deb installer",
);
assert.match(
  source,
  /if \(await openDownloadedDeb\(debPath, manifest\.version\)\) \{\s*debPath = null;/s,
  "the downloaded deb must be retained after the installer is opened",
);
assert.match(
  source,
  /const finalPath = join\(app\.getPath\("downloads"\), fileName\)/,
  "the downloaded deb must be saved in the user's Downloads directory with the server filename",
);
assert.match(
  source,
  /fs\.renameSync\(downloadPath, finalPath\)/,
  "the completed download should be atomically renamed to the server filename before opening",
);
assert.doesNotMatch(
  source,
  /tmpdir\(\)|process\.pid|Date\.now\(\)/,
  "the downloaded deb path must not be renamed into a temporary filename",
);

console.log("debUpdateInstaller tests passed");
