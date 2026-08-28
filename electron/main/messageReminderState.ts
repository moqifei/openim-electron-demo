export type ReminderConversation = {
  conversationID: string;
  title: string;
  body: string;
  updatedAt: number;
};

export type ReminderConversationInput = {
  conversationID: string;
  title: string;
  body: string;
  updatedAt?: number;
};

const reminderConversations = new Map<string, ReminderConversation>();

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

export const addReminderConversation = ({
  conversationID,
  title,
  body,
  updatedAt = Date.now(),
}: ReminderConversationInput) => {
  const safeConversationID = conversationID.trim();
  if (!safeConversationID) return getReminderConversations();

  reminderConversations.set(safeConversationID, {
    conversationID: safeConversationID,
    title: normalizeText(title) || "消息",
    body: normalizeText(body),
    updatedAt,
  });

  return getReminderConversations();
};

export const getReminderConversations = () =>
  Array.from(reminderConversations.values()).sort(
    (prev, next) => next.updatedAt - prev.updatedAt,
  );

export const clearReminderConversation = (conversationID: string) => {
  reminderConversations.delete(conversationID);
  return getReminderConversations();
};

export const clearReminderConversations = () => {
  reminderConversations.clear();
};

export const buildReminderTooltip = (appName: string) => {
  const titles = getReminderConversations().map((item) => item.title);
  return titles.length ? `${appName}\n${titles.join("\n")}` : appName;
};
export const buildReminderPanelHtml = (
  appName: string,
  conversations = getReminderConversations(),
) => {
  const items = conversations
    .map(
      (
        item,
      ) => `<a class="conversation" href="openim-tray://conversation/${encodeURIComponent(
        item.conversationID,
      )}">
        <span class="title">${escapeHtml(item.title)}</span>
        <span class="body">${escapeHtml(item.body)}</span>
      </a>`,
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <style>
      html, body {
        margin: 0;
        min-width: 240px;
        overflow: hidden;
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
      }
      .panel {
        overflow: hidden;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      }
      .header {
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 10px;
        border-bottom: 1px solid #eee;
        color: #222;
        font-size: 12px;
      }
      .conversation {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 9px 10px;
        border-bottom: 1px solid #edf0f5;
        color: #222;
        text-decoration: none;
      }
      .conversation:hover {
        background: #f5f7fa;
      }
      .title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 13px;
        font-weight: 600;
        line-height: 18px;
      }
      .body {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #7a7f8c;
        font-size: 12px;
        line-height: 16px;
      }
      .ignore-all {
        display: block;
        padding: 8px 10px;
        color: #1677ff;
        font-size: 13px;
        line-height: 18px;
        text-decoration: none;
      }
      .ignore-all:hover {
        background: #f5f7fa;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="header">${escapeHtml(appName)}</div>
      ${items}
      <a class="ignore-all" href="openim-tray://ignore-all">忽略全部</a>
    </div>
  </body>
</html>`;
};
