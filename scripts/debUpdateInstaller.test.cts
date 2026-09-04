import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(process.cwd(), "electron/main/debUpdateManage.ts"),
  "utf8",
);

assert.match(
  source,
  /shell\.openPath\(debPath\)/,
  "UOS updates should open the downloaded deb with the system default installer",
);
assert.doesNotMatch(
  source,
  /spawn\("\/usr\/bin\/pkexec"/,
  "UOS updates should not run dpkg directly through pkexec",
);
assert.match(
  source,
  /if \(await openDownloadedDeb\(debPath, manifest\.version\)\) \{\s*debPath = null;/s,
  "the downloaded deb must be retained after the installer is opened",
);
assert.match(
  source,
  /debPath = join\(tmpdir\(\), `\$\{fileName\}\.\$\{process\.pid\}\.\$\{Date\.now\(\)\}\.deb`\)/,
  "the downloaded file must keep a .deb extension for desktop file association",
);

console.log("debUpdateInstaller tests passed");
