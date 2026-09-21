import { MessageType } from "@openim/wasm-client-sdk";
import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";

export type HistorySearchTab = "all" | "media" | "file";

export const getSearchMessageTypes = (tab: HistorySearchTab) => {
  if (tab === "media") {
    return [MessageType.PictureMessage, MessageType.VideoMessage];
  }
  if (tab === "file") {
    return [MessageType.FileMessage];
  }
  return undefined;
};

const allHistoryMessageTypes = Object.values(MessageType).filter(
  (value): value is MessageType => typeof value === "number",
);

export const getHistorySearchKeywords = (keyword: string) => {
  const trimmedKeyword = keyword.trim();
  return trimmedKeyword ? [trimmedKeyword] : [];
};

export const getHistorySearchMessageTypes = (tab: HistorySearchTab) =>
  getSearchMessageTypes(tab) || allHistoryMessageTypes;

export type HistoryPageItem = { page: number } | { jumpToPage: number };

export const getHistoryPageItems = (
  currentPage: number,
  totalPages: number,
): HistoryPageItem[] => {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, index) => ({
      page: index + 1,
    }));
  }

  const visiblePages = Array.from(
    new Set([1, 2, Math.min(Math.max(currentPage, 1), totalPages), totalPages]),
  ).sort((first, second) => first - second);

  return visiblePages.flatMap((page, index) => {
    const previousPage = visiblePages[index - 1];
    if (previousPage && page - previousPage > 1) {
      return [{ jumpToPage: previousPage + 1 }, { page }];
    }
    return [{ page }];
  });
};

export const getHistoryPageMessages = <T>(
  messages: T[],
  pageIndex: number,
  pageSize: number,
) => {
  const endIndex = Math.max(messages.length - (pageIndex - 1) * pageSize, 0);
  const startIndex = Math.max(endIndex - pageSize, 0);
  return messages.slice(startIndex, endIndex);
};

export const getHistoryMessageSummary = (message: MessageItem) => {
  switch (message.contentType) {
    case MessageType.TextMessage:
      return message.textElem?.content || "";
    case MessageType.AtTextMessage:
      return message.atTextElem?.text || "";
    case MessageType.PictureMessage:
      return "图片";
    case MessageType.VideoMessage:
      return "视频";
    case MessageType.FileMessage:
      return message.fileElem?.fileName || "文件";
    default:
      return message.content || "消息";
  }
};

export const filterHistoryMessages = (
  messages: MessageItem[],
  keyword: string,
  tab: HistorySearchTab,
) => {
  const messageTypes = getSearchMessageTypes(tab);
  const searchKeyword = keyword.trim().toLocaleLowerCase();

  return messages.filter((message) => {
    if (messageTypes && !messageTypes.includes(message.contentType)) {
      return false;
    }
    return (
      !searchKeyword ||
      getHistoryMessageSummary(message).toLocaleLowerCase().includes(searchKeyword)
    );
  });
};

export const getHistoryPictureUrls = (message: MessageItem) => {
  const snapshotUrl = message.pictureElem?.snapshotPicture?.url || "";
  const sourceUrl = message.pictureElem?.sourcePicture?.url || "";
  if (!snapshotUrl && !sourceUrl) return undefined;
  return {
    thumbnailUrl: snapshotUrl || sourceUrl,
    previewUrl: sourceUrl || snapshotUrl,
  };
};

export const formatHistoryDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatHistoryTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
