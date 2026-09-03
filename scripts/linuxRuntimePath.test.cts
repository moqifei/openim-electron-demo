import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const createShortcutSource = read("scripts/linuxCreateDesktopShortcut.sh");
const removeShortcutSource = read("scripts/linuxRemoveDesktopShortcut.sh");

assert.match(
  createShortcutSource,
  /target="\$SYSTEM_BIN_DIR\/\$EXECUTABLE_NAME"[\s\S]*ln -sfn "\$APP_DIR\/\$EXECUTABLE_NAME" "\$target"/,
);
assert.match(createShortcutSource, /Exec=\/opt\/StickyCake\/年糕 %U/);
assert.match(createShortcutSource, /Icon=\/opt\/StickyCake\/resources\/dist\/icons\/icon-new\.png/);
assert.match(
  removeShortcutSource,
  /target="\$SYSTEM_BIN_DIR\/\$EXECUTABLE_NAME"[\s\S]*rm -f "\$target"/,
);

console.log("linuxRuntimePath tests passed");
