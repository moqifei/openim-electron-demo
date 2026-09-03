import { app, BrowserWindow, Menu, screen, Tray } from "electron";
import { t } from "i18next";

import { IpcMainToRender } from "../constants";
import {
  buildReminderPanelHtml,
  buildReminderTooltip,
  clearReminderConversations,
} from "./messageReminderState";
import type { ReminderConversation } from "./messageReminderState";
import { hideWindow, sendEvent, showWindow } from "./windowManage";

const PANEL_WIDTH = 256;
const PANEL_MARGIN = 8;
const PANEL_HIDE_DELAY_MS = 200;
const TRAY_HOVER_HITBOX_SIZE = 36;

type TrayPanelAnchor = Electron.Rectangle | Electron.Point;

let appTray: Tray | null = null;
let trayFlashTimer: NodeJS.Timeout | null = null;
let trayPanelHideTimer: NodeJS.Timeout | null = null;
let trayPanelMouseTimer: NodeJS.Timeout | null = null;
let trayPanelWindow: BrowserWindow | null = null;
let trayPanelHtml = "";
let trayFlashVisible = true;
let trayAttentionConversations: ReminderConversation[] = [];
let latestTrayPanelAnchor: TrayPanelAnchor | undefined;
let latestTrayHoverBounds: Electron.Rectangle | undefined;
let trayHoverFallbackTimer: NodeJS.Timeout | null = null;

const isRectangleAnchor = (anchor: TrayPanelAnchor): anchor is Electron.Rectangle =>
  "width" in anchor && "height" in anchor;

const isPointInBounds = (
  point: Electron.Point,
  bounds: Pick<Electron.Rectangle, "x" | "y" | "width" | "height">,
) =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

const clearTrayPanelHideTimer = () => {
  if (!trayPanelHideTimer) return;
  clearTimeout(trayPanelHideTimer);
  trayPanelHideTimer = null;
};

const hideTrayReminderPanel = () => {
  clearTrayPanelHideTimer();
  if (trayPanelMouseTimer) {
    clearInterval(trayPanelMouseTimer);
    trayPanelMouseTimer = null;
  }
  if (trayHoverFallbackTimer) {
    clearTimeout(trayHoverFallbackTimer);
    trayHoverFallbackTimer = null;
  }
  if (trayPanelWindow && !trayPanelWindow.isDestroyed()) {
    trayPanelWindow.hide();
  }
};

const scheduleHideTrayReminderPanel = () => {
  if (trayPanelHideTimer) return;
  trayPanelHideTimer = setTimeout(() => {
    hideTrayReminderPanel();
  }, PANEL_HIDE_DELAY_MS);
};

const ignoreAllReminderConversations = () => {
  clearReminderConversations();
  clearTrayAttention();
  hideTrayReminderPanel();
};

export const openConversationFromTray = (conversationID: string) => {
  showWindow();
  sendEvent(IpcMainToRender.openConversationFromTray, { conversationID });
  hideTrayReminderPanel();
};

const handleTrayPanelUrl = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (url.protocol !== "openim-tray:") return;

  if (url.hostname === "ignore-all") {
    ignoreAllReminderConversations();
    return;
  }

  if (url.hostname === "conversation") {
    const conversationID = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (conversationID) {
      openConversationFromTray(conversationID);
    }
  }
};

const ensureTrayReminderPanel = () => {
  if (trayPanelWindow && !trayPanelWindow.isDestroyed()) {
    return trayPanelWindow;
  }

  trayPanelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: 120,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  trayPanelWindow.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    handleTrayPanelUrl(url);
  });

  trayPanelWindow.webContents.setWindowOpenHandler(({ url }) => {
    handleTrayPanelUrl(url);
    return { action: "deny" };
  });

  trayPanelWindow.on("blur", scheduleHideTrayReminderPanel);
  trayPanelWindow.on("closed", () => {
    trayPanelWindow = null;
  });

  return trayPanelWindow;
};

const getPanelHeight = () => 66 + trayAttentionConversations.length * 57;

const getTrayHoverBounds = (anchor?: TrayPanelAnchor): Electron.Rectangle => {
  if (anchor && isRectangleAnchor(anchor) && anchor.width > 0) {
    return anchor;
  }

  const point = anchor ?? screen.getCursorScreenPoint();
  const halfSize = TRAY_HOVER_HITBOX_SIZE / 2;
  return {
    x: Math.round(point.x - halfSize),
    y: Math.round(point.y - halfSize),
    width: TRAY_HOVER_HITBOX_SIZE,
    height: TRAY_HOVER_HITBOX_SIZE,
  };
};

const getTrayPanelAnchor = (fallback?: Electron.Point): TrayPanelAnchor => {
  if (appTray && !appTray.isDestroyed()) {
    const bounds = appTray.getBounds();
    if (bounds.width > 0 && bounds.height > 0) {
      return bounds;
    }
  }
  return fallback ?? screen.getCursorScreenPoint();
};

const getPanelBounds = (anchorSource?: TrayPanelAnchor) => {
  const pointer = screen.getCursorScreenPoint();
  const anchor =
    anchorSource && isRectangleAnchor(anchorSource) && anchorSource.width > 0
      ? {
          x: anchorSource.x + anchorSource.width / 2,
          y: anchorSource.y,
          height: anchorSource.height,
        }
      : {
          x: anchorSource?.x ?? pointer.x,
          y: anchorSource?.y ?? pointer.y,
          height: 0,
        };
  const display = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y });
  const workArea = display.workArea;
  const height = getPanelHeight();
  const x = Math.min(
    Math.max(Math.round(anchor.x - PANEL_WIDTH / 2), workArea.x),
    workArea.x + workArea.width - PANEL_WIDTH,
  );
  const yAbove = Math.round(anchor.y - height - PANEL_MARGIN);
  const yBelow = Math.round(anchor.y + anchor.height + PANEL_MARGIN);
  const workAreaBottom = workArea.y + workArea.height;
  const hasSpaceAbove = yAbove >= workArea.y;
  const hasSpaceBelow = yBelow + height <= workAreaBottom;
  let y = yAbove;
  if (!hasSpaceAbove) {
    y = hasSpaceBelow
      ? yBelow
      : Math.max(workArea.y, Math.min(yAbove, workAreaBottom - height));
  }

  return { x, y, width: PANEL_WIDTH, height };
};

const startTrayPanelMouseMonitor = (panelBounds: Electron.Rectangle) => {
  if (trayPanelMouseTimer) {
    clearInterval(trayPanelMouseTimer);
  }
  trayPanelMouseTimer = setInterval(() => {
    const pointer = screen.getCursorScreenPoint();
    const isInTray = latestTrayHoverBounds
      ? isPointInBounds(pointer, latestTrayHoverBounds)
      : false;
    const isInPanel = isPointInBounds(pointer, panelBounds);
    if (isInTray || isInPanel) {
      clearTrayPanelHideTimer();
      return;
    }
    scheduleHideTrayReminderPanel();
  }, 120);
};

const showTrayReminderPanel = (anchor?: TrayPanelAnchor) => {
  if (trayAttentionConversations.length === 0) return;
  latestTrayPanelAnchor = anchor ?? latestTrayPanelAnchor;
  latestTrayHoverBounds = getTrayHoverBounds(latestTrayPanelAnchor);

  const panel = ensureTrayReminderPanel();
  clearTrayPanelHideTimer();
  const panelBounds = getPanelBounds(latestTrayPanelAnchor);
  const html = buildReminderPanelHtml(app.getName(), trayAttentionConversations);
  panel.setBounds(panelBounds, false);
  if (html !== trayPanelHtml) {
    trayPanelHtml = html;
    panel.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }
  panel.showInactive();
  startTrayPanelMouseMonitor(panelBounds);
  if (trayHoverFallbackTimer) {
    clearTimeout(trayHoverFallbackTimer);
  }
  trayHoverFallbackTimer = setTimeout(() => {
    trayHoverFallbackTimer = null;
    if (!trayAttentionConversations.length) return;
    if (
      trayPanelWindow &&
      !trayPanelWindow.isDestroyed() &&
      trayPanelWindow.isVisible()
    ) {
      return;
    }
    const pointer = screen.getCursorScreenPoint();
    const bounds = latestTrayHoverBounds;
    if (bounds && isPointInBounds(pointer, bounds)) {
      showTrayReminderPanel(latestTrayPanelAnchor);
    }
  }, 150);
};

const handleTrayHover = (position: Electron.Point) => {
  clearTrayPanelHideTimer();
  if (
    !trayPanelWindow ||
    trayPanelWindow.isDestroyed() ||
    !trayPanelWindow.isVisible()
  ) {
    showTrayReminderPanel(getTrayPanelAnchor(position));
  }
};

const buildTrayMenu = () => {
  const reminderItems: Electron.MenuItemConstructorOptions[] =
    trayAttentionConversations.length > 0
      ? [
          ...trayAttentionConversations.map((item) => ({
            label: item.title,
            click: () => openConversationFromTray(item.conversationID),
          })),
          {
            label: "忽略全部",
            click: ignoreAllReminderConversations,
          },
          { type: "separator" as const },
        ]
      : [];

  return Menu.buildFromTemplate([
    ...reminderItems,
    {
      label: t("system.showWindow"),
      click: showWindow,
    },
    {
      label: t("system.hideWindow"),
      click: hideWindow,
    },
    {
      label: t("system.toggleDevTools"),
      role: "toggleDevTools",
    },
    {
      label: t("system.quit"),
      click: () => {
        global.forceQuit = true;
        app.quit();
      },
    },
  ]);
};

const updateTrayContextMenu = () => {
  if (!appTray || appTray.isDestroyed()) return;
  appTray.setContextMenu(buildTrayMenu());
};

const restoreTray = () => {
  if (!appTray || appTray.isDestroyed()) return;
  appTray.setImage(global.pathConfig.trayIcon);
  appTray.setToolTip(app.getName());
  updateTrayContextMenu();
};

export const createTray = () => {
  appTray = new Tray(global.pathConfig.trayIcon);
  appTray.setToolTip(app.getName());
  appTray.setIgnoreDoubleClickEvents(true);
  appTray.on("click", (_event, bounds) => {
    clearTrayAttention();
    latestTrayPanelAnchor = bounds;
    latestTrayHoverBounds = getTrayHoverBounds(bounds);
    showWindow();
  });
  appTray.on("mouse-enter", (_event, position) => {
    handleTrayHover(position);
  });
  appTray.on("mouse-move", (_event, position) => {
    handleTrayHover(position);
  });
  appTray.on("mouse-leave", () => {
    scheduleHideTrayReminderPanel();
  });

  updateTrayContextMenu();
};

export const stopTrayAttentionFlash = () => {
  if (trayFlashTimer) {
    clearInterval(trayFlashTimer);
    trayFlashTimer = null;
  }
  trayFlashVisible = true;
  restoreTray();
};

export const setTrayAttention = (conversations: ReminderConversation[]) => {
  if (!appTray || appTray.isDestroyed()) return;
  trayAttentionConversations = conversations;
  appTray.setToolTip(buildReminderTooltip(app.getName()));
  updateTrayContextMenu();

  if (
    trayPanelWindow &&
    !trayPanelWindow.isDestroyed() &&
    trayPanelWindow.isVisible()
  ) {
    showTrayReminderPanel();
  }

  if (trayFlashTimer) return;
  trayFlashVisible = true;
  trayFlashTimer = setInterval(() => {
    if (!appTray || appTray.isDestroyed()) return;
    trayFlashVisible = !trayFlashVisible;
    appTray.setImage(
      trayFlashVisible ? global.pathConfig.trayIcon : global.pathConfig.emptyTrayIcon,
    );
  }, 500);
};

export const clearTrayAttention = () => {
  trayAttentionConversations = [];
  trayPanelHtml = "";
  hideTrayReminderPanel();
  stopTrayAttentionFlash();
};

export const destroyTray = () => {
  clearTrayAttention();
  if (trayPanelWindow && !trayPanelWindow.isDestroyed()) {
    trayPanelWindow.destroy();
    trayPanelWindow = null;
  }
  if (trayHoverFallbackTimer) {
    clearTimeout(trayHoverFallbackTimer);
    trayHoverFallbackTimer = null;
  }
  if (!appTray || appTray.isDestroyed()) return;
  appTray.destroy();
  appTray = null;
};
