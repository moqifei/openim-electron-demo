export type ReminderPayload = {
  title: string;
  body: string;
};

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const normalizeReminderText = (text: string) => text.replace(/\s+/g, " ").trim();

export const buildReminderHtml = ({ title, body }: ReminderPayload) => {
  const safeTitle = escapeHtml(normalizeReminderText(title));
  const safeBody = escapeHtml(normalizeReminderText(body));

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
        width: 100%;
        height: 100%;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(24, 28, 36, 0.96);
        color: #f4f7fb;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
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
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="toast">
      <div class="title">${safeTitle}</div>
      <div class="body">${safeBody}</div>
    </div>
  </body>
</html>`;
};
