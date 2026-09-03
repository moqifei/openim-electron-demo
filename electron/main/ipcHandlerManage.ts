import {
  BrowserWindow,
  clipboard,
  Menu,
  app,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from "electron";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { createRequire } from "node:module";
import fs from "fs";
import * as iconv from "iconv-lite";
import * as net from "net";
import os from "os";
import path from "path";
import { pathToFileURL } from "node:url";
import {
  clearCache,
  closeWindow,
  minimize,
  showSelectDialog,
  showSaveDialog,
  showWindow,
  shakeMainWindow,
  taskFlicker,
  splashEnd,
  updateMaximize,
} from "./windowManage";
import { t } from "i18next";
import { IpcRenderToMain, IpcMainToRender } from "../constants";
import { getPngDimensions } from "../utils/pngDimensions";
import { getStore } from "./storeManage";
import { uint8ArrayToDataUrl } from "../utils/screenshotData";
import { getDownloadFileFilters } from "../utils/downloadFileFilters";
import { changeLanguage } from "../i18n";
import { logger } from ".";
import { updateScreenshotShortcut } from "./shortcutManage";
import { checkForUpdates as checkForDebUpdates } from "./debUpdateManage";
import { checkForUpdates as checkForWindowsUpdates } from "./updateManage";
import {
  clearMessageReminderConversation,
  showMessageReminder,
} from "./messageReminderManage";

const requireModule = createRequire(__filename);

type NativeScreenshots = import("electron-screenshots").default;

let nativeScreenshots: NativeScreenshots | null = null;

const getNativeScreenshots = async (): Promise<NativeScreenshots> => {
  if (nativeScreenshots) return nativeScreenshots;

  const screenshotsModule = requireModule("electron-screenshots");
  const Screenshots = screenshotsModule.default ?? screenshotsModule;
  logger.info("[screenshot] loaded electron-screenshots", {
    resolvedPath: requireModule.resolve("electron-screenshots"),
  });
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

const getDownloadDirectory = () => {
  const configuredPath = store.get("downloadPath");
  if (
    typeof configuredPath === "string" &&
    path.isAbsolute(configuredPath) &&
    fs.existsSync(configuredPath)
  ) {
    return configuredPath;
  }

  const defaultDirectory = app.getPath("downloads");
  store.set("downloadPath", defaultDirectory);
  return defaultDirectory;
};

const getKeyStoreValue = (key: string) =>
  key === "downloadPath" ? getDownloadDirectory() : store.get(key);

const openLocalPath = async (filePath: string) => {
  if (process.platform === "linux") {
    const systemEnv = { ...process.env };
    delete systemEnv.LD_LIBRARY_PATH;
    delete systemEnv.GIO_MODULE_DIR;
    delete systemEnv.GSETTINGS_SCHEMA_DIR;
    const xdgOpenError = await new Promise<Error | null>((resolve) => {
      execFile("xdg-open", [filePath], { env: systemEnv }, (error) => {
        resolve(error);
      });
    });

    if (!xdgOpenError) return "";
    logger.warn("[ipcMain] xdg-open failed, falling back to Electron shell", {
      filePath,
      error: xdgOpenError,
    });
  }

  return shell.openPath(filePath);
};

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
    const recovered = Buffer.from(iconv.encode(filePath, "gb18030")).toString("utf8");
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

  // [修复] IM/Chat 端口: 任一候选端口可达即视为服务可用(兼容 20001/10001 新旧端口二选一)
  if (!imPorts.length) return false;
  const imAvailable = (
    await Promise.all(
      imPorts.map((port) => probeTcpPort(environment.imHost.trim(), port, timeoutMs)),
    )
  ).some(Boolean);

  const chatAvailable = chatPorts.length
    ? (
        await Promise.all(
          chatPorts.map((port) =>
            probeTcpPort(environment.chatHost.trim(), port, timeoutMs),
          ),
        )
      ).some(Boolean)
    : true;

  return imAvailable && chatAvailable;
};

export const setIpcMainListener = () => {
  ipcMain.handle(IpcRenderToMain.clearSession, () => {
    clearCache();
  });

  // 渲染进程完成退出登录后，回传信号给主进程
  ipcMain.on(IpcMainToRender.requestLogoutBeforeQuit + ":done", () => {
    // 仅作为信号标记，实际退出逻辑在 appManage 的 before-quit 中 await
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
  ipcMain.handle(IpcRenderToMain.checkForUpdates, async () => {
    if (process.platform === "linux") {
      return checkForDebUpdates({ manual: true });
    }
    return checkForWindowsUpdates({ manual: true });
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
        ports = { im: [20001, 10001], chat: [] },
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
        im: Array.isArray(ports.im) ? ports.im : [20001, 10001],
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

  // 探测 IM WebSocket 候选端口，返回第一个可达的端口（用于端口迁移平滑过渡）
  ipcMain.handle(
    IpcRenderToMain.probeImWsPort,
    async (
      _,
      {
        host,
        ports = [20001, 10001],
        timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
      }: { host?: string; ports?: number[]; timeoutMs?: number },
    ) => {
      const safeHost = (host ?? "").trim();
      const safePorts = Array.isArray(ports)
        ? ports.filter(isValidPort)
        : [20001, 10001];
      const safeTimeoutMs =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? Math.min(timeoutMs, 5000)
          : DEFAULT_PROBE_TIMEOUT_MS;
      if (!isValidHost(safeHost)) return null;
      for (const port of safePorts) {
        if (await probeTcpPort(safeHost, port, safeTimeoutMs)) {
          return port;
        }
      }
      return null;
    },
  );

  // data transfer
  ipcMain.handle(IpcRenderToMain.setKeyStore, (_, { key, data }) => {
    store.set(key, data);
  });
  ipcMain.handle(IpcRenderToMain.getKeyStore, (_, { key }) => {
    return getKeyStoreValue(key);
  });
  ipcMain.on(IpcRenderToMain.getKeyStoreSync, (e, { key }) => {
    e.returnValue = getKeyStoreValue(key);
  });
  ipcMain.handle(
    IpcRenderToMain.updateScreenshotShortcut,
    (_, shortcut: unknown) => updateScreenshotShortcut(shortcut),
  );
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
  ipcMain.handle(IpcRenderToMain.writeClipboardImage, (_, base64: string) => {
    const image = nativeImage.createFromDataURL(base64);
    if (image.isEmpty()) throw new Error("Invalid clipboard image");
    clipboard.writeImage(image);
  });
  ipcMain.handle(
    IpcRenderToMain.writeClipboardImageFile,
    (_, data: ArrayBuffer) => {
      const image = nativeImage.createFromBuffer(Buffer.from(data));
      if (image.isEmpty()) throw new Error("Invalid clipboard image file");
      clipboard.writeImage(image);
    },
  );
  ipcMain.handle(
    IpcRenderToMain.copyLocalFileToClipboard,
    async (_, filePath: string) => {
      if (!filePath || !path.isAbsolute(filePath)) return "Invalid file path";
      if (!fs.existsSync(filePath)) return "File does not exist";
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return "Path is not a file";

      if (process.platform === "win32") {
        const escapedPath = filePath.replace(/'/g, "''");
        const command = `$ErrorActionPreference = 'Stop'; Set-Clipboard -LiteralPath '${escapedPath}'`;
        return await new Promise<string>((resolve) => {
          execFile(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", command],
            { windowsHide: true },
            (error, _stdout, stderr) => {
              if (error) {
                logger.warn("[clipboard] copy file failed", {
                  filePath,
                  error: error.message,
                  stderr: stderr.trim(),
                });
                resolve(error.message);
                return;
              }
              resolve("");
            },
          );
        });
      }

      clipboard.writeBuffer(
        "text/uri-list",
        Buffer.from(`${pathToFileURL(filePath).href}\r\n`, "utf8"),
      );
      return "";
    },
  );
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
  ipcMain.handle(
    IpcRenderToMain.openFileDialog,
    async (_, options: Electron.OpenDialogOptions) => {
      const result = await showSelectDialog(options);
      return result.canceled ? [] : result.filePaths.map(normalizeDialogFilePath);
    },
  );
  ipcMain.handle(
    IpcRenderToMain.chooseDownloadPath,
    async (_, { fileName }: { fileName?: string }) => {
      const safeName = path.basename(fileName || "download") || "download";
      const result = await showSaveDialog({
        defaultPath: path.join(getDownloadDirectory(), safeName),
        filters: getDownloadFileFilters(safeName),
      });
      return result.canceled || !result.filePath ? false : result.filePath;
    },
  );
  ipcMain.handle(
    IpcRenderToMain.saveDownloadedFile,
    async (
      _,
      {
        data,
        fileName,
        filePath,
      }: { data: ArrayBuffer; fileName: string; filePath?: string },
    ) => {
      const safeName = path.basename(fileName) || "download";
      const targetPath = filePath || path.join(getDownloadDirectory(), safeName);
      if (!path.isAbsolute(targetPath)) return false;
      await fs.promises.writeFile(targetPath, Buffer.from(data));
      return targetPath;
    },
  );

  ipcMain.handle(IpcRenderToMain.openLocalPath, async (_, filePath: string) => {
    if (!filePath || !path.isAbsolute(filePath)) return "Invalid file path";
    if (!fs.existsSync(filePath)) return "File does not exist";
    return openLocalPath(filePath);
  });

  ipcMain.handle(IpcRenderToMain.openLocalFolder, async (_, filePath: string) => {
    if (!filePath || !path.isAbsolute(filePath)) return "Invalid file path";
    if (!fs.existsSync(filePath)) return "File does not exist";
    shell.showItemInFolder(filePath);
    return "";
  });

  ipcMain.handle(
    IpcRenderToMain.uploadObjectFileFromPath,
    async (
      _,
      {
        filePath,
        uploadName,
        contentType,
        cause,
        baseURL,
        token,
      }: {
        filePath: string;
        uploadName: string;
        contentType: string;
        cause: string;
        baseURL: string;
        token?: string;
      },
    ) => {
      if (!filePath || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
        throw new Error(`Selected file is unreadable: ${filePath}`);
      }
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile() || stat.size === 0) {
        throw new Error(
          !stat.isFile() ? "Selected path is not a file" : "不能上传空文件",
        );
      }

      const axiosModule = requireModule("axios") as any;
      const axios = axiosModule.default ?? axiosModule;
      const FormData = requireModule("form-data") as any;
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath), {
        filename: uploadName,
        contentType,
      });
      form.append("name", uploadName);
      form.append("contentType", contentType);
      form.append("cause", cause);

      const uploadUrl = new URL("/object/upload", `${baseURL}/`).toString();
      logger.info("[uploadObjectFileFromPath] start", {
        uploadUrl,
        filePath,
        uploadName,
        contentType,
        cause,
        fileSize: stat.size,
      });

      const response = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          ...(token ? { token } : {}),
          operationID: randomUUID(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 10 * 60 * 1000,
      });

      if (response.data?.errCode && response.data.errCode !== 0) {
        throw response.data;
      }

      logger.info("[uploadObjectFileFromPath] success", {
        uploadUrl,
        filePath,
        uploadName,
        fileSize: stat.size,
      });
      return response.data;
    },
  );

  ipcMain.on(
    IpcRenderToMain.notifyIncomingMessage,
    (
      _,
      payload: {
        conversationID?: string;
        title?: string;
        body?: string;
      },
    ) => {
      if (!payload?.conversationID || !payload?.title || !payload?.body) return;
      showMessageReminder({
        conversationID: payload.conversationID,
        title: payload.title,
        body: payload.body,
      });
      logger.info("[reminder] incoming message", {
        conversationID: payload.conversationID,
        title: payload.title,
        body: payload.body,
      });
    },
  );

  ipcMain.on(
    IpcRenderToMain.trayConversationOpened,
    (_, payload: { conversationID?: string }) => {
      if (!payload?.conversationID) return;
      clearMessageReminderConversation(payload.conversationID);
    },
  );

  ipcMain.on(
    IpcRenderToMain.requestMainWindowAttention,
    () => {
      taskFlicker();
    },
  );

  ipcMain.on(
    IpcRenderToMain.shakeMainWindow,
    (_, payload?: { durationMs?: number }) => {
      shakeMainWindow(payload?.durationMs);
    },
  );

  // Screenshot: capture the focused display at native resolution without changing window state.
  ipcMain.handle(IpcRenderToMain.startScreenshot, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const display = win
      ? screen.getDisplayMatching(win.getBounds())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) ||
        screen.getPrimaryDisplay();

    logger.info("[screenshot] capture started", {
      appIsPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      displayId: display.id,
      displayBounds: display.bounds,
      scaleFactor: display.scaleFactor,
    });
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
          const onOk = async (
            event: { preventDefault: () => void },
            buffer: Uint8Array,
          ) => {
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

        return selectedDataUrl ? { dataUrl: selectedDataUrl, isSelection: true } : null;
    } catch (error) {
      logger.warn(
        "[screenshot] native overlay failed; continuing with display capture",
        {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : String(error),
        },
      );
    }

      // macOS: use native screencapture for reliable full-screen capture
      if (process.platform === "darwin") {
        let nativeFailed = false;
        const tmpFile = path.join(os.tmpdir(), `openim_screenshot_${Date.now()}.png`);

        try {
          await new Promise<void>((resolve, reject) => {
            execFile(
              "/usr/sbin/screencapture",
              ["-x", "-m", "-T0", tmpFile],
              (error) => {
                if (error) reject(error);
                else resolve();
              },
            );
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
            try {
              fs.unlinkSync(tmpFile);
            } catch (_) {}
          }
        }

        if (nativeFailed) {
          // Check if screen recording permission is active via desktopCapturer
          const checkSources = await desktopCapturer.getSources({
            types: ["window"],
            thumbnailSize: { width: 10, height: 10 },
          });
          const nonEmptyWindows = checkSources.filter((s) => !s.thumbnail.isEmpty());

          if (checkSources.length > 0 && nonEmptyWindows.length === 0) {
            throw new Error("SCREEN_RECORDING_PERMISSION_DENIED");
          }
        }
      }

      // Prefer node-screenshots because it captures the monitor directly at native
      // resolution instead of returning an Electron thumbnail.
      try {
        const { Monitor } = requireModule(
          "node-screenshots",
        ) as typeof import("node-screenshots");
        logger.info("[screenshot] loaded node-screenshots", {
          resolvedPath: requireModule.resolve("node-screenshots"),
        });
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
        return {
          dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
          isSelection: false,
        };
      } catch (error) {
        logger.warn(
          "[screenshot] native monitor capture failed; using thumbnail fallback",
          {
            error:
              error instanceof Error
                ? { name: error.name, message: error.message, stack: error.stack }
                : String(error),
          },
        );
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
