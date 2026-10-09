import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(process.cwd(), "electron/main/trayManage.ts"),
  "utf8",
);

assert.match(
  source,
  /nativeImage\.createFromPath\(iconPath\)/,
  "tray images should be decoded before Electron applies them",
);
assert.match(
  source,
  /logger\.error\("\[tray\] image load failed"/,
  "tray image failures should be written to the main-process log",
);
assert.match(
  source,
  /logger\.info\("\[tray\] created", diagnostics\)/,
  "tray creation should record a diagnostic baseline",
);
assert.match(
  source,
  /setTrayImage\(global\.pathConfig\.trayIcon, "restore"\)/,
  "tray restoration should be tagged in diagnostics",
);
assert.match(
  source,
  /setTrayImage\(\s*trayFlashVisible \? global\.pathConfig\.trayIcon : global\.pathConfig\.emptyTrayIcon,\s*"attention-flash",\s*\)/,
  "tray attention updates should be tagged in diagnostics",
);
assert.match(
  source,
  /const setTrayImage = \(iconPath: string, trigger: string\) => \{[\s\S]*?catch \(error\) \{[\s\S]*?return false;/,
  "tray image failures should not escape the main-process event handler",
);

console.log("tray image diagnostics tests passed");
