# Chat Screenshot and Mention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Correct the 200M upload warning, eliminate the screenshot selection preview artifact, and add group-chat avatar mention controls without showing message actions on avatar hover.

**Architecture:** Keep the shared upload-size guard and change only its Chinese resource. Remove the electron-screenshots selection-overlay branch so the main process returns a full native display capture; the existing renderer ScreenshotCropper remains the only selection surface. Route avatar mention requests from ChatContent to ChatFooter through a typed mitt event and reuse the footer's tracked mention insertion.

**Tech Stack:** Electron, React, TypeScript, SCSS modules, Ant Design, mitt, Playwright, Node assertion scripts.

## Global Constraints

- Keep the threshold exactly 200 _ 1024 _ 1024 bytes; a file at the threshold remains allowed.
- Use the exact copy 上传文件大小不得超过 200M.
- Do not modify existing upload diagnostics/retry behavior, private-chat semantics, screenshot encoding, clipboard handling, or pending-file insertion.
- Show the avatar mention control only for another user's message in a group conversation.
- Preserve screenshot window hiding/restoration and do not patch node_modules.

---

### Task 1: Upload Warning Copy

**Files:**

- Modify: src/i18n/resources/zh.json
- Modify: scripts/objectUpload.test.cts

**Interfaces:**

- Consumes: toast.fileSizeExceedsLimit used by uploadObjectFile.
- Produces: the approved Chinese copy with the existing 200 MiB boundary tests intact.

- [ ] **Step 1: Add a failing assertion**

Add fs and path imports to the existing object-upload script and assert the resource value:

```ts
const zhResources = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src/i18n/resources/zh.json"), "utf8"),
);
assert.equal(zhResources.toast.fileSizeExceedsLimit, "上传文件大小不得超过200M");
```

Place it after the existing MAX_OBJECT_UPLOAD_FILE_SIZE assertions.

- [ ] **Step 2: Verify the test fails**

Run npx tsx scripts/objectUpload.test.cts. It must fail on the new assertion because the current value is 文件大小不能超过 200M！.

- [ ] **Step 3: Make the minimal resource change**

Change only the Chinese resource entry to:

```json
"fileSizeExceedsLimit": "上传文件大小不得超过200M",
```

Do not change src/api/imApi.ts, the English resource, or the shared size predicate.

- [ ] **Step 4: Verify the focused test passes**

Run npx tsx scripts/objectUpload.test.cts. Expect objectUpload tests passed.

- [ ] **Step 5: Commit only this task**

```powershell
git add -- src/i18n/resources/zh.json scripts/objectUpload.test.cts
git commit -m "fix: clarify upload file size limit"
```

---

### Task 2: Remove the Defective Screenshot Selection Overlay

**Files:**

- Modify: electron/main/ipcHandlerManage.ts
- Modify: e2e/screenshotData.spec.ts
- Modify: scripts/screenshotSilentBehavior.test.cts

**Interfaces:**

- Consumes: the existing display lookup, native monitor capture, Electron thumbnail fallback, and startScreenshot(hideWindow).
- Produces: { dataUrl, isSelection: false } or null for the renderer cropper path.

- [ ] **Step 1: Add failing no-overlay regression assertions**

Append to e2e/screenshotData.spec.ts:

```ts
test("uses the renderer cropper instead of the third-party selection overlay", () => {
  const ipcSource = fs.readFileSync("electron/main/ipcHandlerManage.ts", "utf8");
  expect(ipcSource).not.toContain('requireModule("electron-screenshots")');
  expect(ipcSource).not.toContain("getNativeScreenshots");
  expect(ipcSource).not.toContain("screenshots.startCapture");
  expect(ipcSource).toContain("isSelection: false");
});
```

Add to scripts/screenshotSilentBehavior.test.cts:

```ts
assert.doesNotMatch(
  ipcSource,
  /electron-screenshots|getNativeScreenshots|startCapture\(\)/,
);
assert.match(ipcSource, /isSelection:\s*false/);
```

- [ ] **Step 2: Verify the new tests fail**

Run npx playwright test e2e/screenshotData.spec.ts and npx tsx scripts/screenshotSilentBehavior.test.cts. The new assertions must fail while the current overlay branch exists.

- [ ] **Step 3: Remove only the overlay path**

In electron/main/ipcHandlerManage.ts, remove the NativeScreenshots type, cached nativeScreenshots value, and getNativeScreenshots function. Delete the startCapture promise block between the “Use the native overlay first” comment and the macOS capture branch. Keep the existing window hiding delay, macOS capture, node-screenshots monitor capture, Electron thumbnail fallback, and finally restoration.

Every successful capture path must return isSelection: false; the renderer will then set screenshotSrc and open ScreenshotCropper. Do not change ChatFooter clipboard or pending-file handling.

- [ ] **Step 4: Verify screenshot tests pass**

Run npx playwright test e2e/screenshotData.spec.ts and npx tsx scripts/screenshotSilentBehavior.test.cts. Expect all tests to pass and the script to print screenshotSilentBehavior tests passed.

- [ ] **Step 5: Manually verify the defect is gone**

At a non-100% display scale where possible, activate screenshot, drag a selection, and confirm the selected area is uniform with no internal white/gray split. Verify selection, annotation, confirmation, clipboard, pending-image insertion, and hide-window restoration.

- [ ] **Step 6: Commit only this task**

```powershell
git add -- electron/main/ipcHandlerManage.ts e2e/screenshotData.spec.ts scripts/screenshotSilentBehavior.test.cts
git commit -m "fix: remove screenshot selection preview artifacts"
```

---

### Task 3: Add Group Avatar Mention and Content-Only Actions

**Files:**

- Modify: src/utils/events.ts
- Modify: src/pages/chat/queryChat/ChatContent.tsx
- Modify: src/pages/chat/queryChat/ChatFooter/index.tsx
- Modify: src/pages/chat/queryChat/MessageItem/index.tsx
- Modify: src/pages/chat/queryChat/MessageItem/message-item.module.scss
- Modify: src/i18n/resources/zh.json
- Modify: src/i18n/resources/en.json
- Create: e2e/chatMessageHover.spec.ts

**Interfaces:**

- Consumes: MessageItemType, SessionType.Group, sender fields, mitt, AtMemberInfo, and CKEditorRef.
- Produces: CHAT_FOOTER_MENTION_MEMBER and MessageItem props isGroupChat and onAvatarMention.

- [ ] **Step 1: Add a failing source-contract test**

Create e2e/chatMessageHover.spec.ts:

```ts
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("separates avatar mention and message action hover states", () => {
  const events = read("src/utils/events.ts");
  const content = read("src/pages/chat/queryChat/ChatContent.tsx");
  const footer = read("src/pages/chat/queryChat/ChatFooter/index.tsx");
  const item = read("src/pages/chat/queryChat/MessageItem/index.tsx");
  const styles = read("src/pages/chat/queryChat/MessageItem/message-item.module.scss");

  expect(events).toContain("CHAT_FOOTER_MENTION_MEMBER");
  expect(content).toContain("isGroupChat={isGroupChat}");
  expect(content).toContain("onAvatarMention={handleAvatarMention}");
  expect(footer).toContain('emitter.on("CHAT_FOOTER_MENTION_MEMBER"');
  expect(footer).toContain("editorRef.current?.insertText(replacement)");
  expect(item).toContain("showAvatarMention");
  expect(item).toContain('aria-label={t("placeholder.mention")}');
  expect(styles).toContain(".avatarMentionButton");
});
```

- [ ] **Step 2: Verify it fails**

Run npx playwright test e2e/chatMessageHover.spec.ts. It must fail because the event, props, independent hover state, and control do not exist.

- [ ] **Step 3: Add the typed event and footer subscription**

In src/utils/events.ts, add:

```ts
export type ChatFooterMentionMember = {
  userID: string;
  nickname: string;
  faceURL: string;
  groupNickname: string;
};
```

Add CHAT_FOOTER_MENTION_MEMBER: ChatFooterMentionMember to EmitterEvents.

Add a localized tooltip/accessibility label under the existing placeholder resources:

```json
"mention": "@成员"
```

Use `"mention": "Mention member"` in the English resource.

In ChatContent.tsx, beside handleAvatarClick, add:

```ts
const isGroupChat = currentConversation?.conversationType === SessionType.Group;

const handleAvatarMention = useCallback((msg: MessageItemType) => {
  emitter.emit("CHAT_FOOTER_MENTION_MEMBER", {
    userID: msg.sendID,
    nickname: msg.senderNickname,
    faceURL: msg.senderFaceUrl,
    groupNickname: msg.senderNickname,
  });
}, []);
```

Pass isGroupChat={isGroupChat} and onAvatarMention={handleAvatarMention} to MessageItem.

In ChatFooter/index.tsx, import emitter and the event type. Extract tracked insertion into:

```ts
const insertMention = useCallback((member: ChatFooterMentionMember) => {
  const replacement = "@" + member.nickname + " ";
  atMembersRef.current.set(member.userID, {
    nickname: member.nickname,
    groupNickname: member.groupNickname || member.nickname,
  });
  if (atTriggerNeedsRemovalRef.current) {
    atTriggerNeedsRemovalRef.current = false;
    editorRef.current?.replaceTextBeforeSelection(1, replacement);
  } else {
    editorRef.current?.insertText(replacement);
  }
}, []);
```

Make popup selection call insertMention and close the popup. Subscribe and clean up:

```ts
useEffect(() => {
  const handleAvatarMention = (member: ChatFooterMentionMember) => {
    if (isGroupChat) insertMention(member);
  };
  emitter.on("CHAT_FOOTER_MENTION_MEMBER", handleAvatarMention);
  return () => emitter.off("CHAT_FOOTER_MENTION_MEMBER", handleAvatarMention);
}, [insertMention, isGroupChat]);
```

- [ ] **Step 4: Split avatar and content hover state**

In MessageItem, import AtOutlined, add onAvatarMention?: (message: MessageItemType) => void, and replace the row-level hover state with:

```ts
const [avatarHovered, setAvatarHovered] = useState(false);
const [contentHovered, setContentHovered] = useState(false);
const showActions = !disabled && !isMultiSelectActive && contentHovered;
const showAvatarMention =
  Boolean(isGroupChat) &&
  !isSender &&
  !disabled &&
  !isMultiSelectActive &&
  avatarHovered;
```

Remove outer-row hover handlers. Wrap OIMAvatar with avatar hover handlers and render an icon-only button when showAvatarMention is true. The button must stop propagation, call onAvatarMention(message), use Tooltip with t("placeholder.mention"), and have the same accessible label. Put content hover handlers on menu-wrap so the action toolbar is content-only.

- [ ] **Step 5: Add the avatar control style**

Inside message-container in message-item.module.scss, add a relative avatarWrap and a 22px avatarMentionButton positioned at right: calc(100% + 6px), centered vertically, using the existing primary color, base background, border, small radius, and hover background. Do not add a sender-side control.

- [ ] **Step 6: Verify the interaction contract**

Run npx playwright test e2e/chatMessageHover.spec.ts and npm run lint. Expect both to pass. Manually verify group-other-user avatar hover shows only @, clicking inserts @昵称 and preserves tracking, message-content hover shows the existing toolbar, and self/private avatars show no @.

- [ ] **Step 7: Commit only this task**

```powershell
git add -- src/utils/events.ts src/pages/chat/queryChat/ChatContent.tsx src/pages/chat/queryChat/ChatFooter/index.tsx src/pages/chat/queryChat/MessageItem/index.tsx src/pages/chat/queryChat/MessageItem/message-item.module.scss src/i18n/resources/zh.json src/i18n/resources/en.json e2e/chatMessageHover.spec.ts
git commit -m "feat: add avatar mention in group chat"
```

---

### Task 4: Final Verification

**Files:** Verify all files from Tasks 1-3.

- [ ] **Step 1: Run focused checks**

Run npx tsx scripts/objectUpload.test.cts, npx tsx scripts/screenshotSilentBehavior.test.cts, and npx playwright test e2e/screenshotData.spec.ts e2e/chatMessageHover.spec.ts. Expect all to pass.

- [ ] **Step 2: Run the project build**

Run npm run build. Expect Vite to exit with code 0.

- [ ] **Step 3: Check the scoped diff**

Run git diff --check and git status --short. Expect no whitespace errors and only intended task files in addition to pre-existing user changes.

- [ ] **Step 4: Commit any final test-only correction**

```powershell
git add -- e2e/screenshotData.spec.ts e2e/chatMessageHover.spec.ts scripts/objectUpload.test.cts scripts/screenshotSilentBehavior.test.cts
git commit -m "test: cover chat screenshot and mention behavior"
```
