import assert = require("assert");
import fs = require("fs");
import path = require("path");

const filePath = path.join(process.cwd(), "electron/main/trayManage.ts");
const source = fs.readFileSync(filePath, "utf8");

assert.ok(
  source.includes('appTray.on("mouse-move"'),
  "Windows tray hover must use mouse-move; mouse-enter is macOS-only",
);
assert.ok(
  /appTray\.on\("mouse-move",\s*\(_event,\s*position\)\s*=>\s*\{[\s\S]*?handleTrayHover\(position\)/.test(
    source,
  ),
  "mouse-move should use the fixed-position tray hover handler",
);
assert.ok(
  source.includes("getTrayHoverBounds"),
  "tray panel mouse monitor should have hover bounds when only cursor position is available",
);
assert.ok(
  source.includes("appTray.getBounds()"),
  "tray reminder panel should use the tray bounds as its fixed anchor",
);
assert.ok(
  source.includes("const workAreaBottom = workArea.y + workArea.height;"),
  "tray reminder panel should account for the work area boundary",
);
assert.ok(
  source.includes("const hasSpaceBelow = yBelow + height <= workAreaBottom;"),
  "tray reminder panel should not fall below the work area",
);
assert.ok(
  source.includes("scheduleHideTrayReminderPanel();"),
  "leaving the tray should schedule the reminder panel to hide",
);
assert.ok(
  source.includes("clearTrayPanelHideTimer();\n      return;"),
  "tray panel mouse monitor should keep the panel open while hovered",
);
assert.ok(
  /const scheduleHideTrayReminderPanel = \(\) => \{\s*if \(trayPanelHideTimer\) return;/.test(
    source,
  ),
  "tray panel hide timer should not be reset while the pointer remains outside",
);
assert.ok(
  !source.includes("PANEL_MAX_HEIGHT"),
  "tray reminder panel should grow with stacked messages instead of scrolling",
);

const reminderStatePath = path.join(
  process.cwd(),
  "electron/main/messageReminderState.ts",
);
const reminderStateSource = fs.readFileSync(reminderStatePath, "utf8");
assert.ok(
  /html, body \{[\s\S]*?overflow: hidden;/.test(reminderStateSource),
  "tray reminder panel should hide the scrollbar",
);

console.log("trayHover tests passed");
