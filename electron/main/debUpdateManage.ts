import { dialog, app } from "electron";
import fs from "node:fs";
import { createWriteStream } from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import * as yaml from "js-yaml";

import { isProd } from "../utils";
import { logger } from ".";
import { readUpdateConfig } from "./updateManage";
import {
  DebUpdateManifest,
  getDebManifestUrl,
  getDebUpdateFile,
  isNewerVersion,
} from "./debUpdateUtils";
import {
  isSandboxEnvironment,
  SANDBOX_UPDATE_MESSAGE,
} from "./updateEnvironment";

const MAX_REDIRECTS = 5;
const DEB_MANIFEST_NAME = "latest-linux.yml";
const showSandboxUpdateNotice = () =>
  dialog.showMessageBox({
    type: "info",
    buttons: ["确定"],
    title: "检测到新版本",
    message: SANDBOX_UPDATE_MESSAGE,
  });

let updaterInitialized = false;
let periodicCheckTimer: NodeJS.Timeout | null = null;
let checkInProgress = false;

const requestUrl = (url: string, redirectCount = 0): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const clientRequest = client.get(
      url,
      { headers: { "User-Agent": "StickyCake-updater" } },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error(`Too many redirects while requesting ${url}`));
            return;
          }
          requestUrl(new URL(location, url).toString(), redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Update server returned HTTP ${statusCode} for ${url}`));
          return;
        }

        resolve(response);
      },
    );
    clientRequest.on("error", reject);
  });

const readResponseText = async (response: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of response) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const downloadDeb = async (url: string, destination: string) => {
  const response = await requestUrl(url);
  const output = createWriteStream(destination, { flags: "wx" });

  try {
    await new Promise<void>((resolve, reject) => {
      response.on("error", reject);
      output.on("error", reject);
      output.on("finish", resolve);
      response.pipe(output);
    });
  } catch (error) {
    output.destroy();
    throw error;
  }
};

const installDeb = (debPath: string) =>
  new Promise<number>((resolve, reject) => {
    const installer = spawn("/usr/bin/pkexec", ["/usr/bin/dpkg", "-i", debPath], {
      stdio: "ignore",
    });
    installer.once("error", reject);
    installer.once("exit", (code) => resolve(code ?? 1));
  });

const installDownloadedDeb = async (debPath: string, version: string) => {
  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["立即安装并重启", "稍后"],
    defaultId: 0,
    cancelId: 1,
    title: "发现新版本",
    message: `新版本 ${version} 已下载完成`,
    detail: "安装更新需要系统管理员授权。选择稍后不会安装本次更新。",
  });

  if (result.response !== 0) return;

  try {
    const exitCode = await installDeb(debPath);
    if (exitCode !== 0) {
      await dialog.showMessageBox({
        type: "error",
        title: "更新失败",
        message: `系统安装器返回退出码 ${exitCode}`,
        detail: "当前版本未被替换，请检查权限后重试。",
      });
      return;
    }

    fs.rmSync(debPath, { force: true });
    app.relaunch();
    app.exit(0);
  } catch (error) {
    logger.error("[deb-updater] install failed", error);
    await dialog.showMessageBox({
      type: "error",
      title: "更新失败",
      message: "无法启动系统安装器",
      detail: String(error),
    });
  }
};

const showLatestVersionNotice = () =>
  dialog.showMessageBox({
    type: "info",
    buttons: ["确定"],
    title: "检查更新",
    message: "当前已是最新版本",
    detail: `当前版本 ${app.getVersion()}`,
  });

const runCheck = async (manual = false) => {
  if (checkInProgress) return;
  checkInProgress = true;
  const config = readUpdateConfig();
  let debPath: string | null = null;

  try {
    const manifestUrl = getDebManifestUrl(config.url, DEB_MANIFEST_NAME);
    const manifestResponse = await requestUrl(manifestUrl);
    const manifest = yaml.load(
      await readResponseText(manifestResponse),
    ) as DebUpdateManifest | undefined;

    if (!manifest || typeof manifest !== "object" || typeof manifest.version !== "string") {
      throw new Error("Invalid deb update manifest");
    }

    if (!isNewerVersion(app.getVersion(), manifest.version, config.allowPrerelease)) {
      logger.info("[deb-updater] no update available", app.getVersion());
      if (manual) {
        await showLatestVersionNotice();
      }
      return;
    }

    if (await isSandboxEnvironment()) {
      await showSandboxUpdateNotice();
      return;
    }

    if (manual) {
      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["立即下载", "稍后"],
        defaultId: 0,
        cancelId: 1,
        title: "发现新版本",
        message: `发现新版本 ${manifest.version}`,
        detail: "是否立即下载更新包？",
      });
      if (result.response !== 0) return;
    }

    const updateFile = getDebUpdateFile(manifest, process.arch);
    const updateUrl = new URL(updateFile.url, manifestUrl).toString();
    const fileName = basename(new URL(updateUrl).pathname);
    debPath = join(tmpdir(), `${fileName}.${process.pid}.${Date.now()}.download`);
    logger.info("[deb-updater] downloading update", manifest.version, updateUrl);

    await downloadDeb(updateUrl, debPath);
    await installDownloadedDeb(debPath, manifest.version);
  } catch (error) {
    logger.error("[deb-updater] update failed", error);
  } finally {
    checkInProgress = false;
    if (debPath) {
      fs.rmSync(debPath, { force: true });
    }
  }
};

export const initDebAutoUpdater = () => {
  if (updaterInitialized) return;
  updaterInitialized = true;

  const config = readUpdateConfig();
  if (!config.enabled) {
    logger.info("[deb-updater] disabled by config");
    return;
  }
  if (!isProd || !app.isPackaged) {
    logger.info("[deb-updater] skipped outside packaged production app");
    return;
  }
  if (!config.url) {
    logger.warn("[deb-updater] skipped because update url is empty");
    return;
  }

  if (config.checkOnStart) {
    setTimeout(() => void runCheck(), config.checkDelayMs);
  }
  periodicCheckTimer = setInterval(
    () => void runCheck(),
    Math.max(60 * 1000, config.checkIntervalMs),
  );
  logger.info(
    "[deb-updater] periodic check scheduled every",
    `${config.checkIntervalMs}ms`,
  );
};

export const checkForUpdates = async ({ manual = false }: { manual?: boolean } = {}) => {
  if (!isProd || !app.isPackaged) return;

  const config = readUpdateConfig();
  if (!config.enabled || !config.url) return;

  if (!updaterInitialized) {
    initDebAutoUpdater();
  }

  await runCheck(manual);
};

export const destroyDebAutoUpdater = () => {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
    logger.info("[deb-updater] periodic check cleared");
  }
};
