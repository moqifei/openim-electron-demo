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

const showSandboxUpdateNotice = () =>
  dialog.showMessageBox({
    type: "info",
    buttons: ["确定"],
    title: "检测到新版本",
    message: SANDBOX_UPDATE_MESSAGE,
  });

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

export const initAutoUpdater = () => {
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
  const isSandbox = isSandboxEnvironment();
  autoUpdater.autoDownload = isSandbox ? false : config.autoDownload;
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

  autoUpdater.on("update-available", (info) => {
    logger.info("[updater] update available", info.version);
    if (isSandbox) {
      void showSandboxUpdateNotice();
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    logger.info("[updater] update not available", info.version);
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
    if (isSandbox) {
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
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (error) => {
    logger.error("[updater] update failed", error);
  });

  const runCheck = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      logger.error("[updater] checkForUpdates failed", error);
    });
  };

  // 启动后延迟首次检查
  if (config.checkOnStart) {
    setTimeout(runCheck, config.checkDelayMs);
  }

  // 周期性检查: 即使客户端长期不退出/不重启, 也能持续发现新版本
  const intervalMs = Math.max(60 * 1000, config.checkIntervalMs);
  periodicCheckTimer = setInterval(runCheck, intervalMs);
  logger.info("[updater] periodic check scheduled every", `${intervalMs}ms`);
};

// 应用退出时清理周期性检查定时器, 避免句柄泄漏
export const destroyAutoUpdater = () => {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
    logger.info("[updater] periodic check cleared");
  }
};
