export type ChatPasteClipboardData = {
  plainText?: string;
  htmlText?: string;
  uriList?: string;
};

export type BackspaceAttachmentDeleteContext = {
  key?: string;
  cleanText: string;
  pendingFileCount: number;
};

const decodeHtmlEntities = (text: string) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const extractFirstUriListEntry = (uriList?: string) => {
  if (!uriList) return "";
  for (const line of uriList.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    return trimmed;
  }
  return "";
};

const extractHrefFromHtml = (htmlText?: string) => {
  if (!htmlText) return "";
  const hrefMatch = htmlText.match(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/i);
  if (hrefMatch?.[2]) return decodeHtmlEntities(hrefMatch[2].trim());

  const unquotedMatch = htmlText.match(/<a\b[^>]*href\s*=\s*([^\s>]+)/i);
  if (unquotedMatch?.[1]) return decodeHtmlEntities(unquotedMatch[1].trim());

  return "";
};

const findPlainTextUrl = (plainText: string) => {
  const trimmed = plainText.trim();
  if (!trimmed) return "";

  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch?.[0]) {
    return urlMatch[0].replace(/[),.;\]]+$/g, "");
  }

  return "";
};

export const getPreferredChatPasteUrl = ({
  plainText = "",
  htmlText,
  uriList,
}: ChatPasteClipboardData) => {
  const uri = extractFirstUriListEntry(uriList);
  if (uri) return uri;

  const plainUrl = findPlainTextUrl(plainText);
  if (plainUrl) return plainUrl;

  const href = extractHrefFromHtml(htmlText);
  if (href) return href;

  return "";
};

export const getPreferredChatPasteText = ({
  plainText = "",
  htmlText,
  uriList,
}: ChatPasteClipboardData) => {
  const url = getPreferredChatPasteUrl({ plainText, htmlText, uriList });
  if (url) return url;

  return plainText;
};

export const shouldDeletePendingAttachmentOnBackspace = ({
  key,
  cleanText,
  pendingFileCount,
}: BackspaceAttachmentDeleteContext) => {
  return key === "Backspace" && pendingFileCount > 0 && !cleanText.trim();
};
