import { app, globalShortcut } from "electron";
import { toggleDevTools, triggerScreenshot } from "./windowManage";
import { getStore } from "./storeManage";

const SCREENSHOT_SHORTCUT_KEY = "screenshotShortcut";
const DEFAULT_SCREENSHOT_SHORTCUT = "CommandOrControl+Shift+X";
const DEVTOOLS_SHORTCUT = "CmdOrCtrl+F11";

let screenshotShortcut = DEFAULT_SCREENSHOT_SHORTCUT;

const normalizeShortcut = (value: unknown) => {
  if (typeof value !== "string") return null;

  const shortcut = value.trim();
  if (!shortcut || /\s/.test(shortcut)) return null;
  return shortcut;
};

const isDevToolsShortcut = (shortcut: string) =>
  shortcut.toLowerCase().replaceAll("commandorcontrol", "cmdorctrl") ===
  DEVTOOLS_SHORTCUT.toLowerCase();

const registerScreenshotShortcut = (shortcut: string) => {
  try {
    return globalShortcut.register(shortcut, triggerScreenshot);
  } catch (error) {
    console.warn("[shortcut] register screenshot shortcut failed", {
      shortcut,
      error,
    });
    return false;
  }
};

export const registerShortcuts = () => {
  globalShortcut.register(DEVTOOLS_SHORTCUT, toggleDevTools);

  const storedShortcut = normalizeShortcut(
    getStore().get(SCREENSHOT_SHORTCUT_KEY),
  );
  const configuredShortcut = storedShortcut ?? DEFAULT_SCREENSHOT_SHORTCUT;

  if (registerScreenshotShortcut(configuredShortcut)) {
    screenshotShortcut = configuredShortcut;
    return;
  }

  if (
    configuredShortcut !== DEFAULT_SCREENSHOT_SHORTCUT &&
    registerScreenshotShortcut(DEFAULT_SCREENSHOT_SHORTCUT)
  ) {
    screenshotShortcut = DEFAULT_SCREENSHOT_SHORTCUT;
  }
};

export const updateScreenshotShortcut = (value: unknown) => {
  const nextShortcut = normalizeShortcut(value);
  if (!nextShortcut || isDevToolsShortcut(nextShortcut)) {
    return { success: false, error: "invalid" as const };
  }

  if (nextShortcut === screenshotShortcut) {
    return { success: true, shortcut: screenshotShortcut };
  }

  globalShortcut.unregister(screenshotShortcut);
  if (!registerScreenshotShortcut(nextShortcut)) {
    registerScreenshotShortcut(screenshotShortcut);
    return { success: false, error: "register-failed" as const };
  }

  screenshotShortcut = nextShortcut;
  getStore().set(SCREENSHOT_SHORTCUT_KEY, screenshotShortcut);
  return { success: true, shortcut: screenshotShortcut };
};

export const unregisterShortcuts = () => {
  if (!app.isReady()) return;
  globalShortcut.unregisterAll();
};
