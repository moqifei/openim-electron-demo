import { expect, test } from "@playwright/test";
import { MessageType } from "@openim/wasm-client-sdk";
import { readFileSync } from "fs";
import { resolve } from "path";

const getSearchHelpers = () => {
  try {
    return require("../src/pages/chat/queryChat/ConversationHistoryDrawer/searchHelpers");
  } catch {
    return {};
  }
};

const getLayoutHelpers = () => {
  try {
    return require("../src/pages/chat/queryChat/ConversationHistoryDrawer/layoutHelpers");
  } catch {
    return {};
  }
};

test("maps local history categories to SDK message types", () => {
  const { getSearchMessageTypes } = getSearchHelpers();
  expect(getSearchMessageTypes).toBeDefined();
  expect(getSearchMessageTypes("all")).toBeUndefined();
  expect(getSearchMessageTypes("media")).toEqual([
    MessageType.PictureMessage,
    MessageType.VideoMessage,
  ]);
  expect(getSearchMessageTypes("file")).toEqual([MessageType.FileMessage]);
});

test("creates searchable history summaries for text and files", () => {
  const { getHistoryMessageSummary } = getSearchHelpers();
  expect(getHistoryMessageSummary).toBeDefined();
  expect(
    getHistoryMessageSummary({
      contentType: MessageType.TextMessage,
      textElem: { content: "quarterly report" },
    } as any),
  ).toBe("quarterly report");
  expect(
    getHistoryMessageSummary({
      contentType: MessageType.FileMessage,
      fileElem: { fileName: "report.pdf" },
    } as any),
  ).toBe("report.pdf");
});

test("uses empty keywords with message types for unfiltered local history", () => {
  const { getHistorySearchKeywords, getHistorySearchMessageTypes } = getSearchHelpers();
  expect(getHistorySearchKeywords).toBeDefined();
  expect(getHistorySearchMessageTypes).toBeDefined();
  expect(getHistorySearchKeywords("")).toEqual([]);
  expect(getHistorySearchKeywords(" report ")).toEqual(["report"]);
  expect(getHistorySearchMessageTypes("all")).toContain(MessageType.TextMessage);
  expect(getHistorySearchMessageTypes("all")).toContain(MessageType.FileMessage);
});

test("keeps the first, second, current and last page while ellipses jump to omitted ranges", () => {
  const { getHistoryPageItems } = getSearchHelpers();
  expect(getHistoryPageItems).toBeDefined();
  expect(getHistoryPageItems(1, 10)).toEqual([
    { page: 1 },
    { page: 2 },
    { jumpToPage: 3 },
    { page: 10 },
  ]);
  expect(getHistoryPageItems(5, 10)).toEqual([
    { page: 1 },
    { page: 2 },
    { jumpToPage: 3 },
    { page: 5 },
    { jumpToPage: 6 },
    { page: 10 },
  ]);
});

test("uses the newest local messages for the first history page", () => {
  const { getHistoryPageMessages } = getSearchHelpers();
  expect(getHistoryPageMessages).toBeDefined();

  const messages = Array.from({ length: 45 }, (_, index) => ({
    clientMsgID: String(index + 1),
  }));

  expect(getHistoryPageMessages(messages, 1, 20)).toEqual(messages.slice(25));
  expect(getHistoryPageMessages(messages, 2, 20)).toEqual(messages.slice(5, 25));
  expect(getHistoryPageMessages(messages, 3, 20)).toEqual(messages.slice(0, 5));
});

test("uses a snapshot for a history image thumbnail and the source for preview", () => {
  const { getHistoryPictureUrls } = getSearchHelpers();
  expect(getHistoryPictureUrls).toBeDefined();
  expect(
    getHistoryPictureUrls({
      contentType: MessageType.PictureMessage,
      pictureElem: {
        snapshotPicture: { url: "https://example.com/snapshot.jpg" },
        sourcePicture: { url: "https://example.com/source.jpg" },
      },
    }),
  ).toEqual({
    thumbnailUrl: "https://example.com/snapshot.jpg",
    previewUrl: "https://example.com/source.jpg",
  });
});

test("renders a history image below its sender metadata", () => {
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );
  const metadataPosition = drawerSource.indexOf(
    'className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]"',
  );
  const thumbnailPosition = drawerSource.indexOf("src={pictureUrls.thumbnailUrl}");

  expect(metadataPosition).toBeGreaterThan(-1);
  expect(thumbnailPosition).toBeGreaterThan(metadataPosition);
});

test("allows saving and saving-as history preview images", () => {
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );

  expect(drawerSource).toContain("toolbarRender:");
  expect(drawerSource).toContain("downloadFileWithProgress");
  expect(drawerSource).toContain('"chooseDownloadPath"');
  expect(drawerSource).toContain('title={t("placeholder.save")}');
  expect(drawerSource).toContain('title={t("placeholder.saveAs")}');
});

test("uses an exact-count history pager with the newest page scrolled into view", () => {
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );

  expect(drawerSource).toContain("const DEFAULT_PAGE_SIZE = 20");
  expect(drawerSource).toContain("共 {totalCount} 条");
  expect(drawerSource).toContain("getHistoryPageItems");
  expect(drawerSource).toContain("jumpToPage");
  expect(drawerSource).toContain("getAdvancedHistoryMessageList");
  expect(drawerSource).toContain("data.isEnd");
  expect(drawerSource).not.toContain("加载更多");
  expect(drawerSource).toContain("historyListRef.current?.scrollTo");
});

test("keeps the active history page visible with the configured theme variable", () => {
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );

  expect(drawerSource).toContain('"bg-[var(--primary)] text-white"');
  expect(drawerSource).not.toContain("--primary-color");
});

test("opens the history drawer across the chat window and toggles it from the action bar", () => {
  const chatSource = readFileSync(
    resolve(__dirname, "../src/pages/chat/queryChat/index.tsx"),
    "utf8",
  );
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );
  const actionBarSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
    ),
    "utf8",
  );
  const eventSource = readFileSync(
    resolve(__dirname, "../src/utils/events.ts"),
    "utf8",
  );

  expect(chatSource).toContain(
    "const toggleHistory = () => setHistoryOpen((isOpen) => !isOpen);",
  );
  expect(chatSource).toContain(
    'emitter.on("TOGGLE_CONVERSATION_HISTORY", toggleHistory)',
  );
  expect(drawerSource).toContain('getContainer="#chat-container"');
  expect(drawerSource).not.toContain("conversation-history-container");
  expect(drawerSource).toContain('rootStyle={{ position: "absolute" }}');
  expect(actionBarSource).toContain('emitter.emit("TOGGLE_CONVERSATION_HISTORY")');
  expect(eventSource).toContain("TOGGLE_CONVERSATION_HISTORY: void;");
});

test("uses a wider resizable history drawer while preserving responsive chat width", () => {
  const chatSource = readFileSync(
    resolve(__dirname, "../src/pages/chat/queryChat/index.tsx"),
    "utf8",
  );
  const drawerSource = readFileSync(
    resolve(
      __dirname,
      "../src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx",
    ),
    "utf8",
  );
  const antdStyleSource = readFileSync(
    resolve(__dirname, "../src/styles/antd.scss"),
    "utf8",
  );

  const {
    DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO,
    getConversationHistoryDrawerWidth,
    getConversationHistoryDrawerWidthRatio,
  } = getLayoutHelpers();

  expect(getConversationHistoryDrawerWidth).toBeDefined();
  expect(DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO).toBe(0.4);
  expect(getConversationHistoryDrawerWidth(800)).toBe(320);
  expect(getConversationHistoryDrawerWidth(1400)).toBe(560);
  expect(getConversationHistoryDrawerWidthRatio(100, 800, 580)).toBe(0.4);
  expect(getConversationHistoryDrawerWidthRatio(100, 800, 900)).toBe(0.32);
  expect(getConversationHistoryDrawerWidthRatio(100, 800, 100)).toBe(0.6);
  expect(drawerSource).toContain(
    'rootClassName="chat-drawer conversation-history-drawer"',
  );
  expect(drawerSource).toContain("const RESIZE_HANDLE_WIDTH = 12;");
  expect(drawerSource).toContain(
    'document.addEventListener("mousedown", handleMouseDown)',
  );
  expect(drawerSource).toContain(
    '".conversation-history-drawer .ant-drawer-content-wrapper"',
  );
  expect(antdStyleSource).toContain(
    "&.conversation-history-drawer {\n    margin-top: 0;",
  );
  expect(antdStyleSource).toContain("cursor: col-resize;");
  expect(chatSource).toContain("useSize(chatContainerRef)");
  expect(chatSource).toContain("setHistoryDrawerRatio");
  expect(chatSource).toContain("getConversationHistoryDrawerWidthRatio");
  expect(chatSource).toContain("getConversationHistoryDrawerWidth");
  expect(chatSource).toMatch(
    /width:\s*historyOpen\s*\?\s*`calc\(100% - \$\{historyDrawerWidth\}px\)`\s*:\s*"100%"/,
  );
});
