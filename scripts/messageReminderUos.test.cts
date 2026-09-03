import assert = require("assert");
import fs = require("fs");
import path = require("path");

const reminderSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/messageReminderManage.ts"),
  "utf8",
);

const ipcSource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/ipcHandlerManage.ts"),
  "utf8",
);
const traySource = fs.readFileSync(
  path.join(process.cwd(), "electron/main/trayManage.ts"),
  "utf8",
);

assert.match(reminderSource, /const REMINDER_TIMEOUT_MS = 5000/);
assert.ok(reminderSource.includes("window.showInactive()"));
assert.ok(reminderSource.includes("window.setBounds(getReminderBounds(), false)"));
assert.doesNotMatch(reminderSource, /isLinuxReminder|pageBackground|toastBackground/);
assert.ok(ipcSource.includes("IpcRenderToMain.notifyIncomingMessage"));
assert.ok(ipcSource.includes("showMessageReminder({"));
assert.ok(traySource.includes("handleTrayHover"));
assert.ok(traySource.includes("buildReminderPanelHtml"));

console.log("messageReminderUos tests passed");
