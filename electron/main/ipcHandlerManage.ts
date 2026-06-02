import {
  BrowserWindow,
  Menu,
  app,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
} from "electron";
import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  clearCache,
  closeWindow,
  minimize,
  showWindow,
  splashEnd,
  updateMaximize,
} from "./windowManage";
import { t } from "i18next";
import { IpcRenderToMain } from "../constants";
import { getStore } from "./storeManage";
import { changeLanguage } from "../i18n";

const store = getStore();

export const setIpcMainListener = () => {
  ipcMain.handle(IpcRenderToMain.clearSession, () => {
    clearCache();
  });

  // window manage
  ipcMain.handle("changeLanguage", (_, locale) => {
    store.set("language", locale);
    changeLanguage(locale).then(() => {
      app.relaunch();
      app.exit(0);
    });
  });
  ipcMain.handle("main-win-ready", () => {
    splashEnd();
  });
  ipcMain.handle(IpcRenderToMain.showMainWindow, () => {
    showWindow();
  });
  ipcMain.handle(IpcRenderToMain.minimizeWindow, () => {
    minimize();
  });
  ipcMain.handle(IpcRenderToMain.maxmizeWindow, () => {
    updateMaximize();
  });
  ipcMain.handle(IpcRenderToMain.closeWindow, () => {
    closeWindow();
  });
  ipcMain.handle(IpcRenderToMain.showMessageBox, (_, options) => {
    return dialog
      .showMessageBox(BrowserWindow.getFocusedWindow(), options)
      .then((res) => res.response);
  });

  // data transfer
  ipcMain.handle(IpcRenderToMain.setKeyStore, (_, { key, data }) => {
    store.set(key, data);
  });
  ipcMain.handle(IpcRenderToMain.getKeyStore, (_, { key }) => {
    return store.get(key);
  });
  ipcMain.on(IpcRenderToMain.getKeyStoreSync, (e, { key }) => {
    e.returnValue = store.get(key);
  });
  ipcMain.handle(IpcRenderToMain.showInputContextMenu, () => {
    const menu = Menu.buildFromTemplate([
      {
        label: t("system.copy"),
        type: "normal",
        role: "copy",
        accelerator: "CommandOrControl+c",
      },
      {
        label: t("system.paste"),
        type: "normal",
        role: "paste",
        accelerator: "CommandOrControl+v",
      },
      {
        label: t("system.selectAll"),
        type: "normal",
        role: "selectAll",
        accelerator: "CommandOrControl+a",
      },
    ]);
    menu.popup({
      window: BrowserWindow.getFocusedWindow()!,
    });
  });
  ipcMain.on(IpcRenderToMain.getDataPath, (e, key: string) => {
    switch (key) {
      case "public":
        e.returnValue = global.pathConfig.publicPath;
        break;
      case "sdkResources":
        e.returnValue = global.pathConfig.sdkResourcesPath;
        break;
      case "logsPath":
        e.returnValue = global.pathConfig.logsPath;
        break;
      default:
        e.returnValue = global.pathConfig.publicPath;
        break;
    }
  });

  // Screenshot: hide window, capture full screen, show window, return base64
  ipcMain.handle(IpcRenderToMain.startScreenshot, async (_, hideWindow = true) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      throw new Error("No active window");
    }

    if (hideWindow) {
      win.hide();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;

      // macOS: use native screencapture for reliable full-screen capture
      if (process.platform === "darwin") {
        let nativeFailed = false;
        const tmpFile = path.join(os.tmpdir(), `openim_screenshot_${Date.now()}.png`);

        try {
          await new Promise<void>((resolve, reject) => {
            execFile("/usr/sbin/screencapture", ["-x", "-m", "-T0", tmpFile], (error) => {
              if (error) reject(error);
              else resolve();
            });
          });

          if (fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 0) {
            const buf = fs.readFileSync(tmpFile);
            const dataURL = `data:image/png;base64,${buf.toString("base64")}`;
            return dataURL;
          }
          nativeFailed = true;
        } catch {
          nativeFailed = true;
        } finally {
          if (fs.existsSync(tmpFile)) {
            try { fs.unlinkSync(tmpFile); } catch (_) {}
          }
        }

        if (nativeFailed) {
          // Check if screen recording permission is active via desktopCapturer
          const checkSources = await desktopCapturer.getSources({
            types: ["window"],
            thumbnailSize: { width: 10, height: 10 },
          });
          const nonEmptyWindows = checkSources.filter(s => !s.thumbnail.isEmpty());

          if (checkSources.length > 0 && nonEmptyWindows.length === 0) {
            throw new Error("SCREEN_RECORDING_PERMISSION_DENIED");
          }
        }
      }

      // Fallback: desktopCapturer (non-macOS or macOS with screencapture unavailable)
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height },
      });

      const screenSources = sources.filter((s) => s.id.startsWith("screen:"));
      if (!screenSources || screenSources.length === 0) {
        throw new Error("No screen source captured");
      }

      return screenSources[0].thumbnail.toDataURL();
    } finally {
      if (hideWindow) {
        win.show();
        win.focus();
      }
    }
  });

  // Save screenshot base64 to temp file, return file path
  ipcMain.handle(IpcRenderToMain.saveScreenshotFile, async (_, base64: string) => {
    const buf = Buffer.from(base64.split(",")[1], "base64");
    const tmpDir = path.join(app.getPath("temp"), "openim-screenshots");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const filePath = path.join(tmpDir, `screenshot_${Date.now()}.png`);
    fs.writeFileSync(filePath, buf);
    return filePath;
  });
};
