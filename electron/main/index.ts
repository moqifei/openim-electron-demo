import { app } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./windowManage";
import { createTray } from "./trayManage";
import { setIpcMainListener } from "./ipcHandlerManage";
import { setAppGlobalData, setAppListener, setSingleInstance } from "./appManage";
import createAppMenu from "./menuManage";
import { isLinux } from "../utils";
import { getLogger } from "../utils/log";
import { initI18n } from "../i18n";
import { initAutoUpdater, destroyAutoUpdater } from "./updateManage";
import { initDebAutoUpdater, destroyDebAutoUpdater } from "./debUpdateManage";
import { unregisterShortcuts } from "./shortcutManage";

if (isLinux) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("gtk-version", "3");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  if (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland") {
    app.commandLine.appendSwitch("ozone-platform-hint", "auto");
    app.commandLine.appendSwitch("enable-wayland-ime");
  }
}

export const logger = getLogger(join(app.getPath("userData"), `/OpenIMData/logs`));

app.on("will-quit", unregisterShortcuts);
app.on("will-quit", destroyAutoUpdater);
app.on("will-quit", destroyDebAutoUpdater);

const init = () => {
  initI18n();
  createMainWindow();
  createAppMenu();
  createTray();
  if (isLinux && !process.env.APPIMAGE) {
    initDebAutoUpdater();
  } else {
    initAutoUpdater();
  }
};

setAppGlobalData();
setIpcMainListener();
setSingleInstance();
setAppListener(init);

app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init();
});
