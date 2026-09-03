const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const builderSource = read("electron-builder.json5");
const appManageSource = read("electron/main/appManage.ts");
const windowManageSource = read("electron/main/windowManage.ts");
const shortcutSource = read("scripts/linuxCreateDesktopShortcut.sh");

assert.match(
  builderSource,
  /from: "dist\/icons",\s*to: "icons"/,
  "Linux native icons must be copied to resources/icons",
);
assert.match(
  appManageSource,
  /join\(process\.resourcesPath, "icons"\)/,
  "Production native icons must resolve outside app.asar",
);
assert.match(
  windowManageSource,
  /icon: global\.pathConfig\.trayIcon/,
  "The window icon must use the same native icon path as the tray",
);
assert.match(
  shortcutSource,
  /resources\/icons\/icon-new\.png/,
  "Linux desktop shortcuts must point to the real resources/icons file",
);
assert.doesNotMatch(
  shortcutSource,
  /resources\/dist\/icons\/icon-new\.png/,
  "Linux desktop shortcuts must not point inside app.asar's dist layout",
);

console.log("linux native icon path tests passed");
