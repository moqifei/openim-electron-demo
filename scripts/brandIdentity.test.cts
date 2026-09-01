import assert = require("assert");
import fs = require("fs");
import path = require("path");

const configSource = fs.readFileSync(
  path.join(process.cwd(), "src/config/index.ts"),
  "utf8",
);
const aboutSource = fs.readFileSync(
  path.join(process.cwd(), "src/layout/LeftNavBar/About.tsx"),
  "utf8",
);
const indexSource = fs.readFileSync(
  path.join(process.cwd(), "index.html"),
  "utf8",
);
const builderSource = fs.readFileSync(
  path.join(process.cwd(), "electron-builder.json5"),
  "utf8",
);
const linuxShortcutSource = fs.readFileSync(
  path.join(process.cwd(), "scripts/linuxCreateDesktopShortcut.sh"),
  "utf8",
);
const zhResourceSource = fs.readFileSync(
  path.join(process.cwd(), "src/i18n/resources/zh.json"),
  "utf8",
);
const enResourceSource = fs.readFileSync(
  path.join(process.cwd(), "src/i18n/resources/en.json"),
  "utf8",
);

assert.match(configSource, /APP_NAME = "StickyCake"/);
assert.match(aboutSource, /publicAsset\("icons\/icon-new\.png"\)/);
assert.doesNotMatch(aboutSource, /profile\/logo\.png/);
assert.match(indexSource, /<title>StickyCake<\/title>/);
assert.match(builderSource, /productName: "StickyCake"/);
assert.match(builderSource, /shortcutName: "StickyCake"/);
assert.match(builderSource, /uninstallDisplayName: "StickyCake"/);
assert.match(linuxShortcutSource, /APP_NAME="StickyCake"/);
assert.match(zhResourceSource, /"welcome": "欢迎使用 StickyCake"/);
assert.match(enResourceSource, /"welcome": "Welcome to StickyCake"/);

console.log("brandIdentity tests passed");
