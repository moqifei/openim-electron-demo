import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "fs";
import { join } from "node:path";

import { isProd } from "../utils";
import { logger } from ".";
import {
  isSandboxEnvironment,
  SANDBOX_UPDATE_MESSAGE,
} from "./updateEnvironment";

export type UpdateConfig = {
  enabled?: boolean;
  url?: string;
  checkOnStart?: boolean;
  checkDelayMs?: number;
  checkIntervalMs?: number;
  autoDownload?: boolean;
  autoInstallOnAppQuit?: boolean;
  allowPrerelease?: boolean;
};

const DEFAULT_UPDATE_CONFIG: Required<UpdateConfig> = {
  enabled: true,
  url: "http://xone.qa.bx/im/",
  checkOnStart: true,
  checkDelayMs: 10000,
  checkIntervalMs: 6 * 60 * 60 * 1000,
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
};

let updaterInitialized = false;
let periodicCheckTimer: NodeJS.Timeout | null = null;
let manualCheckRequested = false;
let sandboxNoticePromise: Promise<void> | null = null;
let sandboxUpdateBlockedVersion: string | null = null;
let sandboxEnvironmentDetected = false;

const showSandboxUpdateNotice = () => {
  if (sandboxNoticePromise) return sandboxNoticePromise;

  sandboxNoticePromise = dialog
    .showMessageBox({
      type: "info",
      buttons: ["确定"],
      title: "检测到新版本",
      message: SANDBOX_UPDATE_MESSAGE,
    })
    .then(() => undefined)
    .finally(() => {
      sandboxNoticePromise = null;
    });

  return sandboxNoticePromise;
};

const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const getUpdateConfigPathCandidates = () => [
  join(process.resourcesPath, "update-config.json"),
  join(app.getAppPath(), "build/update-config.json"),
  join(__dirname, "../../build/update-config.json"),
];

export const readUpdateConfig = (): Required<UpdateConfig> => {
  for (const configPath of getUpdateConfigPathCandidates()) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as UpdateConfig;
      return {
        ...DEFAULT_UPDATE_CONFIG,
        ...parsed,
        url: parsed.url ? normalizeBaseUrl(parsed.url) : DEFAULT_UPDATE_CONFIG.url,
      };
    } catch (error) {
      logger.warn("[updater] read update config failed", configPath, error);
    }
  }
  return DEFAULT_UPDATE_CONFIG;
};

export const initAutoUpdater = async () => {
  if (updaterInitialized) return;
  updaterInitialized = true;

  const config = readUpdateConfig();

  if (!config.enabled) {
    logger.info("[updater] disabled by config");
    return;
  }

  if (!isProd || !app.isPackaged) {
    logger.info("[updater] skipped outside packaged production app");
    return;
  }

  if (!config.url) {
    logger.warn("[updater] skipped because update url is empty");
    return;
  }

  autoUpdater.logger = logger;
  const isSandbox = await isSandboxEnvironment();
  sandboxEnvironmentDetected = isSandbox;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = isSandbox
    ? false
    : config.autoInstallOnAppQuit;
  autoUpdater.allowPrerelease = config.allowPrerelease;
  autoUpdater.setFeedURL({
    provider: "generic",
    url: config.url,
  });

  autoUpdater.on("checking-for-update", () => {
    logger.info("[updater] checking for update", config.url);
  });

  autoUpdater.on("update-available", async (info) => {
    logger.info("[updater] update available", info.version);
    const isManualCheck = manualCheckRequested;
    manualCheckRequested = false;
    const isSandboxNow = await isSandboxEnvironment();
    if (isSandboxNow) {
      sandboxUpdateBlockedVersion = info.version;
    }
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = isSandboxNow
      ? false
      : config.autoInstallOnAppQuit;
    if (isSandboxNow) {
      void showSandboxUpdateNotice();
      return;
    }
    if (isManualCheck) {
      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["立即下载", "稍后"],
        defaultId: 0,
        cancelId: 1,
        title: "发现新版本",
        message: `发现新版本 ${info.version}`,
        detail: "是否立即下载更新包？",
      });

      if (result.response === 0) {
        await autoUpdater.downloadUpdate();
      }
      return;
    }
    if (config.autoDownload) {
      await autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-not-available", async (info) => {
    logger.info("[updater] update not available", info.version);
    if (manualCheckRequested) {
      manualCheckRequested = false;
      await dialog.showMessageBox({
        type: "info",
        buttons: ["确定"],
        title: "检查更新",
        message: "当前已是最新版本",
        detail: `当前版本 ${app.getVersion()}`,
      });
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    logger.info(
      "[updater] download progress",
      `${progress.percent.toFixed(1)}%`,
      progress.transferred,
      progress.total,
    );
  });

  autoUpdater.on("update-downloaded", async (info) => {
    logger.info("[updater] update downloaded", info.version);
    if (sandboxUpdateBlockedVersion === info.version) return;
    if (sandboxEnvironmentDetected || (await isSandboxEnvironment())) {
      sandboxUpdateBlockedVersion = info.version;
      await showSandboxUpdateNotice();
      return;
    }
    const result = await dialog.showMessageBox({
      type: "info",
      buttons: ["立即重启更新", "稍后"],
      defaultId: 0,
      cancelId: 1,
      title: "发现新版本",
      message: `新版本 ${info.version} 已下载完成`,
      detail: config.autoInstallOnAppQuit
        ? "可以立即重启完成更新；选择稍后时，客户端退出后会自动安装。"
        : "可以立即重启完成更新。",
    });

    if (result.response === 0) {
      if (await isSandboxEnvironment()) {
        await showSandboxUpdateNotice();
        return;
      }
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (error) => {
    logger.error("[updater] update failed", error);
  });

  const runCheck = async () => {
    autoUpdater.autoDownload = false;
    const isSandboxNow = await isSandboxEnvironment();
    autoUpdater.autoInstallOnAppQuit = isSandboxNow
      ? false
      : config.autoInstallOnAppQuit;
    await autoUpdater.checkForUpdates().catch((error) => {
      logger.error("[updater] checkForUpdates failed", error);
    });
  };

  // 启动后延迟首次检查
  if (config.checkOnStart) {
    setTimeout(() => void runCheck(), config.checkDelayMs);
  }

  // 周期性检查: 即使客户端长期不退出/不重启, 也能持续发现新版本
  const intervalMs = Math.max(60 * 1000, config.checkIntervalMs);
  periodicCheckTimer = setInterval(() => void runCheck(), intervalMs);
  logger.info("[updater] periodic check scheduled every", `${intervalMs}ms`);
};

export const checkForUpdates = async ({ manual = false }: { manual?: boolean } = {}) => {
  if (!updaterInitialized) {
    await initAutoUpdater();
  }

  if (!isProd || !app.isPackaged) return;

  const config = readUpdateConfig();
  if (!config.enabled || !config.url) return;

  if (manual) {
    manualCheckRequested = true;
    autoUpdater.autoDownload = false;
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    manualCheckRequested = false;
    autoUpdater.autoDownload = config.autoDownload;
    throw error;
  }
};

// 应用退出时清理周期性检查定时器, 避免句柄泄漏
export const destroyAutoUpdater = () => {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
    logger.info("[updater] periodic check cleared");
  }
};
