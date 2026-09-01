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

export const escapeChatPasteText = (text: string) =>
  text
    .replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return char;
      }
    })
    .split(/\r\n?|\n/)
    .map((line) =>
      line
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
        .replace(/^ +/, (spaces) => "&nbsp;".repeat(spaces.length))
        .replace(/ {2,}/g, (spaces) => ` ${"&nbsp;".repeat(spaces.length - 1)}`),
    )
    .join("<br>");

export const getPreferredChatPasteText = ({
  plainText = "",
}: ChatPasteClipboardData) => {
  return plainText;
};

export const shouldDeletePendingAttachmentOnBackspace = ({
  key,
  cleanText,
  pendingFileCount,
}: BackspaceAttachmentDeleteContext) => {
  return key === "Backspace" && pendingFileCount > 0 && !cleanText.trim();
};
