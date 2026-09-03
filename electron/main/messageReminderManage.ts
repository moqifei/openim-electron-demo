import { BrowserWindow, screen } from "electron";

import {
  addReminderConversation,
  clearReminderConversation,
  clearReminderConversations,
  getReminderConversations,
} from "./messageReminderState";
import {
  clearTrayAttention,
  openConversationFromTray,
  setTrayAttention,
  stopTrayAttentionFlash,
} from "./trayManage";

const REMINDER_WIDTH = 320;
const REMINDER_HEIGHT = 110;
const REMINDER_MARGIN = 16;
const REMINDER_TIMEOUT_MS = 5000;

type ReminderPayload = {
  conversationID?: string;
  title: string;
  body: string;
};

let reminderWindow: BrowserWindow | null = null;
let reminderTimeout: NodeJS.Timeout | null = null;

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeReminderText = (text: string) => text.replace(/\s+/g, " ").trim();

const buildReminderHtml = ({ conversationID, title, body }: ReminderPayload) => {
  const safeTitle = escapeHtml(normalizeReminderText(title));
  const safeBody = escapeHtml(normalizeReminderText(body));
  const conversationHref = conversationID
    ? `openim-tray://conversation/${encodeURIComponent(conversationID)}`
    : "";
  const toastTag = conversationHref ? "a" : "div";
  const toastAttributes = conversationHref
    ? ` class="toast" href="${conversationHref}"`
    : ` class="toast"`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <style>
      :root {
        color-scheme: light;
      }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .toast {
        box-sizing: border-box;
        display: block;
        width: 100%;
        height: 100%;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(24, 28, 36, 0.96);
        color: #f4f7fb;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
        text-decoration: none;
        cursor: pointer;
      }
      .title {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .body {
        font-size: 13px;
        line-height: 1.5;
        color: rgba(244, 247, 251, 0.9);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
  </head>
  <body>
    <${toastTag}${toastAttributes}>
      <div class="title">${safeTitle}</div>
      <div class="body">${safeBody}</div>
    </${toastTag}>
  </body>
</html>`;
};

const handleReminderUrl = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (url.protocol !== "openim-tray:" || url.hostname !== "conversation") return;

  const conversationID = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!conversationID) return;

  openConversationFromTray(conversationID);
  clearMessageReminderConversation(conversationID);
  hideMessageReminder();
};

const syncTrayAttention = () => {
  const conversations = getReminderConversations();
  if (conversations.length > 0) {
    setTrayAttention(conversations);
    return;
  }
  clearTrayAttention();
};

const getReminderBounds = () => {
  const mainWindow = BrowserWindow.getAllWindows().find((candidate) => {
    if (candidate === reminderWindow || candidate.isDestroyed()) return false;
    const [width] = candidate.getSize();
    return width >= 800;
  });
  const display = mainWindow
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  return {
    x: x + width - REMINDER_WIDTH - REMINDER_MARGIN,
    y: y + height - REMINDER_HEIGHT - REMINDER_MARGIN,
    width: REMINDER_WIDTH,
    height: REMINDER_HEIGHT,
  };
};

const ensureReminderWindow = () => {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    return reminderWindow;
  }

  reminderWindow = new BrowserWindow({
    width: REMINDER_WIDTH,
    height: REMINDER_HEIGHT,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    focusable: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  reminderWindow.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    handleReminderUrl(url);
  });

  reminderWindow.webContents.setWindowOpenHandler(({ url }) => {
    handleReminderUrl(url);
    return { action: "deny" };
  });

  reminderWindow.on("closed", () => {
    reminderWindow = null;
  });

  return reminderWindow;
};

const clearReminderTimeout = () => {
  if (reminderTimeout) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }
};

export const showMessageReminder = (payload: ReminderPayload) => {
  const window = ensureReminderWindow();
  const html = buildReminderHtml(payload);

  clearReminderTimeout();
  if (payload.conversationID) {
    addReminderConversation({
      conversationID: payload.conversationID,
      title: payload.title,
      body: payload.body,
    });
    syncTrayAttention();
  }

  window.setAlwaysOnTop(true, "screen-saver");
  window.setBounds(getReminderBounds(), false);
  window.webContents.once("did-finish-load", () => {
    if (!window.isDestroyed()) {
      window.showInactive();
    }
  });
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  reminderTimeout = setTimeout(() => {
    hideMessageReminder();
  }, REMINDER_TIMEOUT_MS);
};

export const hideMessageReminder = () => {
  clearReminderTimeout();
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.hide();
  }
};

export const clearMessageReminderConversation = (conversationID: string) => {
  clearReminderConversation(conversationID);
  syncTrayAttention();
  stopTrayAttentionFlash();
};

export const clearAllMessageReminders = () => {
  hideMessageReminder();
  clearReminderConversations();
  clearTrayAttention();
};

export const destroyMessageReminder = () => {
  clearAllMessageReminders();
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.destroy();
    reminderWindow = null;
  }
};
