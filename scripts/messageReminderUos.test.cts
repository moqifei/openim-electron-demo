import assert = require("assert");
import fs = require("fs");
import path = require("path");

const source = fs.readFileSync(
  path.join(process.cwd(), "electron/main/messageReminderManage.ts"),
  "utf8",
);

assert.ok(
  source.includes('const isLinuxReminder = process.platform === "linux";'),
  "message reminder should identify Linux/UOS at runtime",
);
assert.ok(
  source.includes("focusable: !isLinuxReminder"),
  "Linux/UOS reminder should remain focusable so the window manager can display it",
);
assert.ok(
  source.includes("transparent: !isLinuxReminder"),
  "Linux/UOS reminder should not depend on transparent window composition",
);
assert.ok(
  source.includes('backgroundColor: isLinuxReminder ? "#181c24" : "#00000000"'),
  "Linux/UOS reminder should have an opaque fallback background",
);
assert.ok(
  source.includes('isLinuxReminder ? "pop-up-menu" : "screen-saver"'),
  "Linux/UOS reminder should use a desktop notification-level window",
);
assert.ok(
  source.includes("window.showInactive();"),
  "reminder should still appear without stealing focus",
);

console.log("messageReminderUos tests passed");
