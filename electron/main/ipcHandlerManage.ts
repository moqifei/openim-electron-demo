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
import * as iconv from "iconv-lite";
import * as net from "net";
import os from "os";
import path from "path";
import {
  clearCache,
  closeWindow,
  minimize,
  showSelectDialog,
  showWindow,
  splashEnd,
  updateMaximize,
} from "./windowManage";
import { t } from "i18next";
import { IpcRenderToMain } from "../constants";
import { getStore } from "./storeManage";
import { changeLanguage } from "../i18n";

const store = getStore();

type ServerEnvironment = {
  key: string;
  name: string;
  imHost: string;
  chatHost: string;
};

type ProbePorts = {
  im: number[];
  chat: number[];
};

const DEFAULT_PROBE_TIMEOUT_MS = 1200;

const recoverMojibakePath = (filePath: string) => {
  if (process.platform !== "win32") return "";

  try {
    const recovered = Buffer.from(iconv.encode(filePath, "gb18030")).toString(
      "utf8",
    );
    if (recovered === filePath || recovered.includes("\uFFFD")) {
      return "";
    }
    return recovered;
  } catch (error) {
    console.warn("[ipcMain] recover mojibake file path failed", error);
    return "";
  }
};

const normalizeDialogFilePath = (filePath: string) => {
  if (!filePath || fs.existsSync(filePath)) return filePath;

  const recoveredPath = recoverMojibakePath(filePath);
  if (recoveredPath && fs.existsSync(recoveredPath)) {
    console.warn("[ipcMain] recovered mojibake file path", {
      filePath,
      recoveredPath,
    });
    return recoveredPath;
  }

  return filePath;
};

const isValidHost = (host: unknown): host is string =>
  typeof host === "string" && host.trim().length > 0;

const isValidPort = (port: unknown): port is number =>
  Number.isInteger(port) && port > 0 && port <= 65535;

const probeTcpPort = (
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
};

const probeEnvironment = async (
  environment: ServerEnvironment,
  ports: ProbePorts,
  timeoutMs: number,
) => {
  if (!isValidHost(environment.imHost) || !isValidHost(environment.chatHost)) {
    return false;
  }

  const imPorts = Array.isArray(ports.im) ? ports.im.filter(isValidPort) : [];
  const chatPorts = Array.isArray(ports.chat) ? ports.chat.filter(isValidPort) : [];
  const checks = [
    ...imPorts.map((port) => probeTcpPort(environment.imHost.trim(), port, timeoutMs)),
    ...chatPorts.map((port) =>
      probeTcpPort(environment.chatHost.trim(), port, timeoutMs),
    ),
  ];

  if (!checks.length) return false;
  return (await Promise.all(checks)).every(Boolean);
};

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
  ipcMain.handle(
    IpcRenderToMain.probeServerEnvironment,
    async (
      _,
      {
        environments = [],
        ports = { im: [10001], chat: [] },
        timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
      }: {
        environments?: ServerEnvironment[];
        ports?: Partial<ProbePorts>;
        timeoutMs?: number;
      },
    ) => {
      const safeTimeoutMs =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? Math.min(timeoutMs, 5000)
          : DEFAULT_PROBE_TIMEOUT_MS;
      const safePorts = {
        im: Array.isArray(ports.im) ? ports.im : [10001],
        chat: Array.isArray(ports.chat) ? ports.chat : [],
      };
      const results = await Promise.all(
        environments.map(async (environment) => ({
          environment,
          available: await probeEnvironment(environment, safePorts, safeTimeoutMs),
        })),
      );

      return results.find((result) => result.available)?.environment ?? null;
    },
  );

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
  ipcMain.handle(IpcRenderToMain.openFileDialog, async (_, options: Electron.OpenDialogOptions) => {
    const result = await showSelectDialog(options);
    return result.canceled ? [] : result.filePaths.map(normalizeDialogFilePath);
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
