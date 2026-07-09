import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "fs";
import { join } from "node:path";

import { isProd } from "../utils";
import { logger } from ".";

type UpdateConfig = {
  enabled?: boolean;
  url?: string;
  checkOnStart?: boolean;
  checkDelayMs?: number;
  autoDownload?: boolean;
  autoInstallOnAppQuit?: boolean;
  allowPrerelease?: boolean;
};

const DEFAULT_UPDATE_CONFIG: Required<UpdateConfig> = {
  enabled: true,
  url: "http://xone.qa.bx/im/",
  checkOnStart: true,
  checkDelayMs: 10000,
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
};

let updaterInitialized = false;

const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const getUpdateConfigPathCandidates = () => [
  join(process.resourcesPath, "update-config.json"),
  join(app.getAppPath(), "build/update-config.json"),
  join(__dirname, "../../build/update-config.json"),
];

const readUpdateConfig = (): Required<UpdateConfig> => {
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
  autoUpdater.autoDownload = config.autoDownload;
  autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit;
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

  if (config.checkOnStart) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        logger.error("[updater] checkForUpdates failed", error);
      });
    }, config.checkDelayMs);
  }
};
