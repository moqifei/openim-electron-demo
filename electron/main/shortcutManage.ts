import { globalShortcut } from "electron";
import { toggleDevTools, triggerScreenshot } from "./windowManage";

export const registerShortcuts = () => {
  globalShortcut.register("CmdOrCtrl+F12", toggleDevTools);
  globalShortcut.register("CommandOrControl+Shift+X", triggerScreenshot);
};

export const unregisterShortcuts = () => {
  globalShortcut.unregisterAll();
};
