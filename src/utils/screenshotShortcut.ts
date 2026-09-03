export const DEFAULT_SCREENSHOT_SHORTCUT = "CommandOrControl+Shift+X";

export const formatScreenshotShortcut = (shortcut: string) =>
  shortcut
    .split("+")
    .map((part) => {
      if (["CommandOrControl", "CmdOrCtrl"].includes(part)) return "Ctrl";
      return part;
    })
    .join(" + ");
