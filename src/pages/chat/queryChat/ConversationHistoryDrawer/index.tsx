import {
  DownloadOutlined,
  FileOutlined,
  LeftOutlined,
  PictureOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { ViewType } from "@openim/wasm-client-sdk";
import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Drawer, Empty, Image, Input, Select, Spin, Tabs, Tag } from "antd";
import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { inferDownloadFileName } from "@/utils/downloadFileName";
import { downloadFileWithProgress } from "@/utils/fileDownload";

import {
  filterHistoryMessages,
  formatHistoryDate,
  formatHistoryTime,
  getHistoryMessageSummary,
  getHistoryPageItems,
  getHistoryPageMessages,
  getHistoryPictureUrls,
  type HistorySearchTab,
} from "./searchHelpers";

const DEFAULT_PAGE_SIZE = 20;
const HISTORY_FETCH_COUNT = 100;
const RESIZE_HANDLE_WIDTH = 12;

type ConversationHistoryDrawerProps = {
  conversationID?: string;
  width: number;
  open: boolean;
  onClose: () => void;
  onResizeStart: (event: MouseEvent) => void;
  onLocateMessage: (message: MessageItem) => void;
};

const getMessageKey = (message: MessageItem) =>
  message.clientMsgID || message.serverMsgID || `${message.seq}-${message.sendTime}`;

const ConversationHistoryDrawer = ({
  conversationID,
  width,
  open,
  onClose,
  onResizeStart,
  onLocateMessage,
}: ConversationHistoryDrawerProps) => {
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<HistorySearchTab>("all");
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const requestID = useRef(0);
  const historyListRef = useRef<HTMLDivElement>(null);

  const filteredMessages = useMemo(
    () => filterHistoryMessages(localMessages, keyword, tab),
    [keyword, localMessages, tab],
  );
  const totalCount = filteredMessages.length;
  const messages = useMemo(
    () => getHistoryPageMessages(filteredMessages, pageIndex, pageSize),
    [filteredMessages, pageIndex, pageSize],
  );

  const groupedMessages = useMemo(() => {
    const groups = new Map<string, MessageItem[]>();
    messages.forEach((message) => {
      const date = formatHistoryDate(message.sendTime || message.createTime);
      groups.set(date, [...(groups.get(date) || []), message]);
    });
    return Array.from(groups.entries());
  }, [messages]);
  const historyImages = useMemo(
    () =>
      messages.reduce<
        { message: MessageItem; thumbnailUrl: string; previewUrl: string }[]
      >((items, message) => {
        const pictureUrls = getHistoryPictureUrls(message);
        if (pictureUrls) items.push({ message, ...pictureUrls });
        return items;
      }, []),
    [messages],
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageItems = useMemo(
    () => getHistoryPageItems(pageIndex, totalPages),
    [pageIndex, totalPages],
  );

  const loadLocalMessages = useCallback(async () => {
    if (!conversationID) return;
    const activeRequestID = requestID.current + 1;
    requestID.current = activeRequestID;
    setLoading(true);
    setSearchFailed(false);

    try {
      const messageMap = new Map<string, MessageItem>();
      const requestedCursors = new Set<string>();
      let startClientMsgID = "";

      while (!requestedCursors.has(startClientMsgID)) {
        requestedCursors.add(startClientMsgID);
        const { data } = await IMSDK.getAdvancedHistoryMessageList({
          conversationID,
          count: HISTORY_FETCH_COUNT,
          startClientMsgID,
          viewType: ViewType.History,
        });
        if (requestID.current !== activeRequestID) return;

        const pageMessages = data.messageList || [];
        pageMessages.forEach((message) => {
          messageMap.set(getMessageKey(message), message);
        });

        const oldestMessageID = pageMessages[0]?.clientMsgID;
        if (data.isEnd || !oldestMessageID || pageMessages.length === 0) break;
        startClientMsgID = oldestMessageID;
      }

      if (requestID.current !== activeRequestID) return;
      setLocalMessages(
        Array.from(messageMap.values()).sort(
          (first, second) =>
            (first.sendTime || first.createTime) -
            (second.sendTime || second.createTime),
        ),
      );
    } catch (error) {
      if (requestID.current !== activeRequestID) return;
      console.error("[conversation-history] local history loading failed", error);
      setSearchFailed(true);
      setLocalMessages([]);
    } finally {
      if (requestID.current === activeRequestID) setLoading(false);
    }
  }, [conversationID]);

  useEffect(() => {
    requestID.current += 1;
    setLocalMessages([]);
    setPageIndex(1);
    setSearchFailed(false);
    if (!open || !conversationID) return;
    void loadLocalMessages();
  }, [conversationID, loadLocalMessages, open]);

  useEffect(() => {
    setPageIndex(1);
  }, [keyword, pageSize, tab]);

  useEffect(() => {
    if (!open) {
      requestID.current += 1;
      setKeyword("");
      setTab("all");
    }
  }, [open]);

  useEffect(() => {
    if (!open || messages.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      historyListRef.current?.scrollTo({
        top: historyListRef.current.scrollHeight,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const drawerWrapper = document.querySelector<HTMLElement>(
        ".conversation-history-drawer .ant-drawer-content-wrapper",
      );
      if (!drawerWrapper) return;

      const { left } = drawerWrapper.getBoundingClientRect();
      const handleStart = left - RESIZE_HANDLE_WIDTH / 2;
      const handleEnd = left + RESIZE_HANDLE_WIDTH;
      if (event.clientX < handleStart || event.clientX > handleEnd) return;

      onResizeStart(event);
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onResizeStart, open]);

  const selectMessage = (message: MessageItem) => {
    onLocateMessage(message);
    onClose();
  };

  return (
    <Drawer
      title="聊天记录"
      placement="right"
      width={width}
      open={open}
      onClose={onClose}
      getContainer="#chat-container"
      rootStyle={{ position: "absolute" }}
      destroyOnClose
      rootClassName="chat-drawer conversation-history-drawer"
      maskClassName="opacity-0"
      maskMotion={{ visible: false }}
      styles={{
        body: { padding: 0 },
        wrapper: { minWidth: 0 },
      }}
    >
      <div className="flex h-full flex-col bg-[var(--bg-base)]">
        <Image.PreviewGroup
          items={historyImages.map((image) => image.previewUrl)}
          preview={{
            visible: imagePreviewVisible,
            current: imagePreviewIndex,
            onVisibleChange: setImagePreviewVisible,
            toolbarRender: (originalNode, { current }) => {
              const originalUrl = historyImages[current]?.previewUrl || "";
              const fileName = inferDownloadFileName({ url: originalUrl });
              return (
                <div className="flex items-center gap-3">
                  {originalNode}
                  <DownloadOutlined
                    title={t("placeholder.save")}
                    className="cursor-pointer text-lg text-white"
                    onClick={() => {
                      if (!originalUrl) return;
                      void downloadFileWithProgress({
                        url: originalUrl,
                        fileName,
                        showProgressToast: true,
                        progressTitle: t("toast.downloading"),
                      }).catch((error) => {
                        console.error("Download history image failed:", error);
                      });
                    }}
                  />
                  <SaveOutlined
                    title={t("placeholder.saveAs")}
                    className="cursor-pointer text-lg text-white"
                    onClick={() => {
                      const ipcInvoke = window.electronAPI?.ipcInvoke;
                      if (!originalUrl || !ipcInvoke) return;
                      void (async () => {
                        const selectedPath = await ipcInvoke<string | false>(
                          "chooseDownloadPath",
                          { fileName },
                        );
                        if (!selectedPath) return;
                        await downloadFileWithProgress({
                          url: originalUrl,
                          fileName,
                          filePath: selectedPath,
                          showProgressToast: true,
                          progressTitle: t("toast.downloading"),
                        });
                      })().catch((error) => {
                        console.error("Save history image as failed:", error);
                      });
                    }}
                  />
                </div>
              );
            },
          }}
        />
        <div className="border-b border-[var(--border-color)] px-4 pt-3">
          <Tabs
            activeKey={tab}
            onChange={(key) => {
              setTab(key as HistorySearchTab);
              setPageIndex(1);
            }}
            items={[
              { key: "all", label: "全部" },
              { key: "media", label: "图片/视频" },
              { key: "file", label: "文件" },
            ]}
          />
          <Input
            allowClear
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPageIndex(1);
            }}
            placeholder="搜索本地聊天记录"
            prefix={<SearchOutlined className="text-[var(--text-placeholder)]" />}
            className="mb-3"
          />
        </div>
        <div ref={historyListRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading && messages.length === 0 && (
            <div className="flex justify-center pt-16">
              <Spin />
            </div>
          )}
          {!loading && searchFailed && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="搜索失败，请重试"
            />
          )}
          {!loading && !searchFailed && messages.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="没有找到本地聊天记录"
            />
          )}
          {groupedMessages.map(([date, dateMessages]) => (
            <section key={date} className="mb-5">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
                {date}
              </h3>
              <div className="space-y-1">
                {dateMessages.map((message) => {
                  const isFile = message.fileElem;
                  const isMedia = message.pictureElem || message.videoElem;
                  const pictureUrls = getHistoryPictureUrls(message);
                  const pictureIndex = pictureUrls
                    ? historyImages.findIndex(
                        (image) =>
                          getMessageKey(image.message) === getMessageKey(message),
                      )
                    : -1;
                  return (
                    <button
                      key={getMessageKey(message)}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => selectMessage(message)}
                    >
                      {!pictureUrls && (
                        <span className="pt-0.5 text-[var(--text-tertiary)]">
                          {isFile ? (
                            <FileOutlined />
                          ) : isMedia ? (
                            <PictureOutlined />
                          ) : null}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                          <span className="truncate">
                            {message.senderNickname || message.sendID}
                          </span>
                          <span>
                            {formatHistoryTime(message.sendTime || message.createTime)}
                          </span>
                        </span>
                        {pictureUrls ? (
                          <Image
                            src={pictureUrls.thumbnailUrl}
                            alt="图片"
                            preview={false}
                            width={88}
                            height={66}
                            rootClassName="mt-1 cursor-zoom-in"
                            className="!h-[66px] !w-[88px] rounded object-cover"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (pictureIndex < 0) return;
                              setImagePreviewIndex(pictureIndex);
                              setImagePreviewVisible(true);
                            }}
                          />
                        ) : (
                          <span className="mt-1 block break-words text-sm leading-5 text-[var(--text-primary)]">
                            {getHistoryMessageSummary(message)}
                          </span>
                        )}
                      </div>
                      {isFile && <Tag className="!mr-0">文件</Tag>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {!searchFailed && messages.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] px-4 py-2 text-sm">
            <span className="whitespace-nowrap text-[var(--text-secondary)]">
              共 {totalCount} 条
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="上一页"
                disabled={loading || pageIndex <= 1}
                className="flex size-7 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPageIndex(pageIndex - 1)}
              >
                <LeftOutlined />
              </button>
              {pageItems.map((item) => {
                if ("jumpToPage" in item) {
                  return (
                    <button
                      key={`jump-${item.jumpToPage}`}
                      type="button"
                      aria-label={`跳转到第${item.jumpToPage}页`}
                      disabled={loading}
                      className="size-7 rounded text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setPageIndex(item.jumpToPage)}
                    >
                      ...
                    </button>
                  );
                }
                return (
                  <button
                    key={item.page}
                    type="button"
                    aria-current={item.page === pageIndex ? "page" : undefined}
                    disabled={loading}
                    className={`size-7 rounded disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.page === pageIndex
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                    onClick={() => setPageIndex(item.page)}
                  >
                    {item.page}
                  </button>
                );
              })}
              <button
                type="button"
                aria-label="下一页"
                disabled={loading || pageIndex >= totalPages}
                className="flex size-7 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPageIndex(pageIndex + 1)}
              >
                <RightOutlined />
              </button>
              <Select
                size="small"
                value={pageSize}
                options={[10, 20, 50].map((value) => ({
                  value,
                  label: `${value} 条/页`,
                }))}
                onChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPageIndex(1);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default ConversationHistoryDrawer;
