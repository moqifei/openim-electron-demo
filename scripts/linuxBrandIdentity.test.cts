import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const builderSource = read("electron-builder.json5");
const createShortcutSource = read("scripts/linuxCreateDesktopShortcut.sh");
const removeShortcutSource = read("scripts/linuxRemoveDesktopShortcut.sh");
const glibcSource = read("scripts/afterPackBundledGlibc.cjs");
const debSource = read("build-linux-deb.sh");

assert.match(builderSource, /productName: "StickyCake"/);
assert.match(builderSource, /executableName: "年糕"/);
assert.match(builderSource, /maintainer: "opencorp-base"/);
assert.match(createShortcutSource, /APP_NAME="StickyCake"/);
assert.match(createShortcutSource, /DISPLAY_NAME="年糕"/);
assert.match(createShortcutSource, /EXECUTABLE_NAME="年糕"/);
assert.match(createShortcutSource, /APP_DIR="\/opt\/StickyCake"/);
assert.match(createShortcutSource, /SHORTCUT_NAME="年糕\.desktop"/);
assert.match(createShortcutSource, /Exec=\/opt\/StickyCake\/年糕 %U/);
assert.match(createShortcutSource, /Icon=\/opt\/StickyCake\/resources\/dist\/icons\/icon-new\.png/);
assert.match(removeShortcutSource, /SHORTCUT_NAME="年糕\.desktop"/);
assert.match(glibcSource, /DEFAULT_EXECUTABLE_NAME = "年糕"/);
assert.match(glibcSource, /DEFAULT_LINUX_INSTALL_DIR = "\/opt\/StickyCake"/);
assert.match(debSource, /PRODUCT_NAME="StickyCake"/);
assert.match(debSource, /Package: stickycake/);
assert.doesNotMatch(createShortcutSource, /Exec=\/opt\/StickyCake\/stickycake/);
assert.doesNotMatch(createShortcutSource, /Exec=\/opt\/OpenCorp-Base\/opencorp-base %U/);
assert.doesNotMatch(createShortcutSource, /EXECUTABLE_NAME="niangao"/);

console.log("linuxBrandIdentity tests passed");
