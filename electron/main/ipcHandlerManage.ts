import {
  BrowserWindow,
  clipboard,
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
import { getPngDimensions } from "../utils/pngDimensions";
import { getStore } from "./storeManage";
import { uint8ArrayToDataUrl } from "../utils/screenshotData";
import { changeLanguage } from "../i18n";
import { logger } from ".";

type NativeScreenshots = import("electron-screenshots").default;

let nativeScreenshots: NativeScreenshots | null = null;

const getNativeScreenshots = async (): Promise<NativeScreenshots> => {
  if (nativeScreenshots) return nativeScreenshots;

  const { default: Screenshots } = await import("electron-screenshots");
  nativeScreenshots = new Screenshots({
    singleWindow: true,
    lang: {
      operation_ok_title: "确认",
      operation_cancel_title: "取消",
      operation_save_title: "保存",
    },
    logger: (...args) => logger.info("[ipcMain] native screenshot", ...args),
  });
  return nativeScreenshots;
};

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

  ipcMain.handle(IpcRenderToMain.readClipboardImage, () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    return `data:image/png;base64,${image.toPNG().toString("base64")}`;
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

  // Screenshot: capture the focused display at native resolution, then show the window.
  ipcMain.handle(IpcRenderToMain.startScreenshot, async (_, hideWindow = true) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      throw new Error("No active window");
    }

    const display = screen.getDisplayMatching(win.getBounds());

    logger.info("[screenshot] capture started", {
      appIsPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      displayId: display.id,
      displayBounds: display.bounds,
      scaleFactor: display.scaleFactor,
      hideWindow,
    });

    if (hideWindow) {
      win.hide();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      // Use the native overlay first. It captures the real display and lets the
      // user select the region directly on top of the current screen instead of
      // selecting from a renderer thumbnail.
      try {
        const screenshots = await getNativeScreenshots();
        const selectedDataUrl = await new Promise<string | null>((resolve, reject) => {
          let settled = false;
          const settle = (value: string | null, error?: unknown) => {
            if (settled) return;
            settled = true;
            screenshots.removeListener("ok", onOk);
            screenshots.removeListener("cancel", onCancel);
            if (error) reject(error);
            else resolve(value);
          };
          const onOk = async (event: { preventDefault: () => void }, buffer: Uint8Array) => {
            event.preventDefault();
            try {
              await screenshots.endCapture();
              logger.info("[screenshot] native overlay selection success", {
                pngSize: getPngDimensions(buffer),
                bytes: buffer.byteLength,
              });
              settle(uint8ArrayToDataUrl(buffer));
            } catch (error) {
              settle(null, error);
            }
          };
          const onCancel = async (event: { preventDefault: () => void }) => {
            event.preventDefault();
            try {
              await screenshots.endCapture();
              settle(null);
            } catch (error) {
              settle(null, error);
            }
          };

          screenshots.once("ok", onOk);
          screenshots.once("cancel", onCancel);
          screenshots.startCapture().catch(async (error) => {
            try {
              await screenshots.endCapture();
            } finally {
              settle(null, error);
            }
          });
        });

        return selectedDataUrl
          ? { dataUrl: selectedDataUrl, isSelection: true }
          : null;
      } catch (error) {
        logger.warn("[screenshot] native overlay failed; continuing with display capture", {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : String(error),
        });
      }

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
            logger.info("[screenshot] macOS native capture success", {
              pngSize: getPngDimensions(buf),
              bytes: buf.byteLength,
            });
            const dataURL = `data:image/png;base64,${buf.toString("base64")}`;
            return { dataUrl: dataURL, isSelection: false };
          }
          nativeFailed = true;
        } catch (error) {
          logger.warn("[screenshot] macOS native capture failed", {
            error:
              error instanceof Error
                ? { name: error.name, message: error.message, stack: error.stack }
                : String(error),
          });
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

      // Prefer node-screenshots because it captures the monitor directly at native
      // resolution instead of returning an Electron thumbnail.
      try {
        const { Monitor } = await import("node-screenshots");
        let point = {
          x: display.bounds.x + display.bounds.width / 2,
          y: display.bounds.y + display.bounds.height / 2,
        };
        if (process.platform === "win32") {
          point = screen.dipToScreenPoint(point);
        }
        const monitor = Monitor.fromPoint(point.x, point.y);
        if (!monitor) {
          throw new Error("No native monitor found");
        }
        const image = await monitor.captureImage();
        const buffer = await image.toPng(true);
        logger.info("[screenshot] native monitor capture success", {
          displayId: display.id,
          point,
          monitorId: monitor.id(),
          monitorBounds: {
            x: monitor.x(),
            y: monitor.y(),
            width: monitor.width(),
            height: monitor.height(),
          },
          monitorScaleFactor: monitor.scaleFactor(),
          pngSize: getPngDimensions(buffer),
          bytes: buffer.byteLength,
        });
        return { dataUrl: `data:image/png;base64,${buffer.toString("base64")}`, isSelection: false };
      } catch (error) {
        logger.warn("[screenshot] native monitor capture failed; using thumbnail fallback", {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : String(error),
        });
      }

      // Fallback: desktopCapturer at the display's physical pixel size.
      const scaleFactor = display.scaleFactor || 1;
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: Math.round(display.bounds.width * scaleFactor),
          height: Math.round(display.bounds.height * scaleFactor),
        },
      });

      const screenSources = sources.filter((s) => s.id.startsWith("screen:"));
      const source =
        screenSources.length === 1
          ? screenSources[0]
          : screenSources.find(
              (item) =>
                item.display_id === String(display.id) ||
                item.id.startsWith(`screen:${display.id}:`),
            ) ?? screenSources[0];
      if (!source) {
        throw new Error("No screen source captured");
      }

      logger.warn("[screenshot] thumbnail fallback result", {
        requestedSize: {
          width: Math.round(display.bounds.width * scaleFactor),
          height: Math.round(display.bounds.height * scaleFactor),
        },
        sourceId: source.id,
        sourceDisplayId: source.display_id,
        isEmpty: source.thumbnail.isEmpty(),
        actualSize: source.thumbnail.getSize(),
      });

      return { dataUrl: source.thumbnail.toDataURL(), isSelection: false };
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
