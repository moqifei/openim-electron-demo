# Local Conversation History Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chat-side history drawer that searches messages already stored by the OpenIM SDK for the active conversation.

**Architecture:** `QueryChat` owns the drawer visibility so it closes whenever its route changes. The send-action toolbar emits a local open callback. A small utility maps tabs to SDK message types and produces a display-safe summary; the drawer calls `IMSDK.searchLocalMessages` using the active conversation ID, debounces inputs, ignores stale requests, and paginates SDK search results.

**Tech Stack:** React, TypeScript, Ant Design `Drawer`/`Input`/`Tabs`/`List`, OpenIM WASM client SDK, Playwright test runner.

## Global Constraints

- Search only messages present in the current device's OpenIM SDK local database.
- Scope every search to the active `conversationID`; no cross-conversation search.
- Do not add or call a server-side chat-history search API.
- Preserve existing message loading, message rendering, and SDK sync behavior.
- Treat images and videos as one media category and files as a file category.

---

### Task 1: Define locally testable search presentation rules

**Files:**

- Create: `src/pages/chat/queryChat/ConversationHistoryDrawer/searchHelpers.ts`
- Test: `e2e/conversationHistorySearch.spec.ts`

**Interfaces:**

- Produces: `getSearchMessageTypes(tab: HistorySearchTab): MessageType[] | undefined`
- Produces: `getHistoryMessageSummary(message: MessageItem): string`
- Produces: `formatHistoryDate(timestamp: number): string`

- [ ] **Step 1: Write the failing test**

```ts
test("maps media and file tabs to the OpenIM message types", () => {
  expect(getSearchMessageTypes("media")).toEqual([
    MessageType.PictureMessage,
    MessageType.VideoMessage,
  ]);
  expect(getSearchMessageTypes("file")).toEqual([MessageType.FileMessage]);
});

test("builds safe summaries for text and file messages", () => {
  expect(getHistoryMessageSummary(textMessage)).toBe("hello");
  expect(getHistoryMessageSummary(fileMessage)).toBe("report.pdf");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts`

Expected: FAIL because `ConversationHistoryDrawer/searchHelpers` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type HistorySearchTab = "all" | "media" | "file";

export const getSearchMessageTypes = (tab: HistorySearchTab) =>
  tab === "media"
    ? [MessageType.PictureMessage, MessageType.VideoMessage]
    : tab === "file"
    ? [MessageType.FileMessage]
    : undefined;
```

Return text content, file name, and stable localized fallback labels from `getHistoryMessageSummary`; format timestamps as a local `YYYY-MM-DD` group key.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts`

Expected: PASS.

### Task 2: Build the scoped history search drawer

**Files:**

- Create: `src/pages/chat/queryChat/ConversationHistoryDrawer/index.tsx`
- Modify: `src/pages/chat/queryChat/index.tsx`

**Interfaces:**

- Consumes: `conversationID: string | undefined`, `open: boolean`, `onClose(): void`.
- Consumes: `getSearchMessageTypes`, `getHistoryMessageSummary`, and `formatHistoryDate` from Task 1.
- Produces: `onLocateMessage(message: MessageItem): Promise<void>` callback invocation when a result is selected.

- [ ] **Step 1: Write the failing component behavior test**

```ts
test("history drawer searches only the supplied conversation", async () => {
  render(<ConversationHistoryDrawer conversationID="single_1" open />);
  await user.type(screen.getByPlaceholderText("搜索聊天记录"), "report");
  await waitFor(() =>
    expect(searchLocalMessages).toHaveBeenCalledWith(
      expect.objectContaining({ conversationID: "single_1", keywordList: ["report"] }),
    ),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts`

Expected: FAIL because the drawer component does not exist.

- [ ] **Step 3: Implement minimal drawer behavior**

```tsx
<Drawer getContainer="#chat-container" placement="right" width={360} ...>
  <Tabs items={tabItems} onChange={setTab} />
  <Input allowClear placeholder="搜索聊天记录" prefix={<SearchOutlined />} />
  <List loadMore={hasMore ? <Button onClick={loadNextPage}>加载更多</Button> : null} />
</Drawer>
```

Only run a keyword search after non-whitespace input. Request 50 messages per page with `conversationID`, `keywordList`, `pageIndex`, `count`, and optional `messageTypeList`. Reset results for a new keyword/tab/conversation, append unique message IDs for later pages, and use a request sequence ref to ignore older responses.

- [ ] **Step 4: Wire the drawer into `QueryChat`**

```tsx
const [historyOpen, setHistoryOpen] = useState(false);
<ConversationHistoryDrawer
  conversationID={conversationID}
  open={historyOpen}
  onClose={() => setHistoryOpen(false)}
  onLocateMessage={findMessageAndLoad}
/>;
```

Share the existing `findMessageAndLoad` capability through a narrowly scoped event or a callback lifted from `ChatContent`; selecting a result must locate the loaded message in the existing virtualized list rather than introduce another message list.

- [ ] **Step 5: Run lint and targeted test**

Run: `npm run lint -- --quiet` and `npx playwright test e2e/conversationHistorySearch.spec.ts`

Expected: both commands exit with status 0.

### Task 3: Add the toolbar entry and verify end-to-end behavior

**Files:**

- Modify: `src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx`
- Modify: `src/pages/chat/queryChat/ChatFooter/index.tsx`
- Modify: `src/pages/chat/queryChat/index.tsx`
- Test: `e2e/conversationHistorySearch.spec.ts`

**Interfaces:**

- Consumes: `onOpenHistory(): void` from `ChatFooter` through `SendActionBar`.
- Produces: a keyboard-accessible history icon with `aria-label="聊天记录"`.

- [ ] **Step 1: Write the failing interaction test**

```ts
test("clicking the chat history toolbar button opens the right drawer", async () => {
  await user.click(screen.getByRole("button", { name: "聊天记录" }));
  expect(screen.getByRole("dialog", { name: "聊天记录" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts`

Expected: FAIL because the toolbar has no history control.

- [ ] **Step 3: Add the minimal toolbar button and callback plumbing**

Use Ant Design `HistoryOutlined` inside a native `button` or an accessible button-styled element. Pass `onOpenHistory` from `QueryChat` through `ChatFooter` to `SendActionBar`; do not add it to file-upload action metadata.

- [ ] **Step 4: Run full relevant verification**

Run: `npm run lint -- --quiet`

Run: `npm run build`

Run: `npx playwright test e2e/conversationHistorySearch.spec.ts e2e/chatAttachment.spec.ts`

Expected: all commands exit with status 0. The build may require its configured native Electron environment; report any environment-only failure separately from a TypeScript or lint failure.

## Self-Review

- Scope coverage: Tasks 1-3 cover the single-conversation local SDK query, all/media/file filtering, right-side drawer, keyword search, pagination, and original-message navigation.
- Placeholder scan: No undefined implementation decisions remain. Link/online-document categories are intentionally excluded because the request only requires representative categories and the installed SDK has no dedicated message types for them.
- Type consistency: all callers use `HistorySearchTab`, `MessageItem`, `conversationID`, and `onOpenHistory` consistently.
