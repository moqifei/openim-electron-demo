import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

const historyHook = read("src/pages/chat/queryChat/useHistoryMessageList.tsx");
const chatContent = read("src/pages/chat/queryChat/ChatContent.tsx");
const quoteRenderer = read(
  "src/pages/chat/queryChat/MessageItem/QuoteMessageRender.tsx",
);
const loginForm = read("src/pages/login/LoginForm.tsx");
const mainContentWrap = read("src/layout/MainContentWrap.tsx");
const storage = read("src/utils/storage.ts");
const userStore = read("src/store/user.ts");
const leftNavBar = read("src/layout/LeftNavBar/index.tsx");

assert.match(
  historyHook,
  /Promise<MessageLocation \| null>/,
  "history locator should return the target message index",
);
assert.match(
  historyHook,
  /findIndex\([\s\S]*isSameMessage\(message, targetMessage\)/,
  "history locator should calculate the target message index",
);
assert.match(
  historyHook,
  /latestMoreOldLoading\.current/,
  "history locator should wait for an in-flight history page before continuing",
);
assert.match(
  historyHook,
  /fetchSurroundingMessages\(/,
  "history locator should fetch the target message context directly",
);
assert.match(
  historyHook,
  /findMessageList\(\[/,
  "history locator should first query the exact quoted message by id",
);
assert.match(
  historyHook,
  /Array\.isArray\(result\)/,
  "history locator should support the Electron SDK message array result",
);
assert.match(
  historyHook,
  /findResultItems\?\.\s*flatMap\(\s*\(item\)\s*=>\s*item\.messageList\s*\|\|\s*\[\]\s*,?\s*\)/,
  "history locator should support the WASM SDK find result items",
);
assert.match(
  historyHook,
  /\[history-location\] start/,
  "history locator should log its input identifiers in development",
);
assert.match(
  historyHook,
  /\[history-location\] loaded-match/,
  "history locator should log when the target is already in the loaded list",
);
assert.match(
  historyHook,
  /\[history-location\] local-result/,
  "history locator should log the exact local lookup result in development",
);
assert.match(
  historyHook,
  /\[history-location\] surrounding-result/,
  "history locator should log the surrounding-message lookup result in development",
);
assert.match(
  historyHook,
  /getAgentStreamRealClientMsgID\(targetMessage\)|serverMsgID === targetMessage\.serverMsgID/,
  "history locator should match virtual and server message ids",
);
assert.match(
  historyHook,
  /left\.seq > 0 && right\.seq > 0 && left\.seq === right\.seq/,
  "history locator should fall back to the stable message sequence",
);
assert.match(
  historyHook,
  /setLoadState\(\(preState\) => \(\{[\s\S]*?messageList: nextMessageList[\s\S]*?\}\)\);[\s\S]*?latestLoadState\.current[\s\S]*?await new Promise/,
  "history locator should wait for the virtual list data to commit before returning the index",
);
assert.match(
  historyHook,
  /for \(let attempt = 0; attempt < 20; attempt \+= 1\)[\s\S]*?latestLoadState\.current[\s\S]*?nextMessageIndex[\s\S]*?await new Promise/,
  "history locator should wait for the updated list before returning the target index",
);
const quoteCallbackIndex = quoteRenderer.indexOf("if (onQuoteMessage)");
const quoteIdGuardIndex = quoteRenderer.indexOf(
  "if (!originalMsg.clientMsgID) return;",
);
assert.ok(
  quoteCallbackIndex >= 0 &&
    quoteIdGuardIndex >= 0 &&
    quoteCallbackIndex < quoteIdGuardIndex,
  "quote clicks should reach the parent locator before the fallback id guard",
);
assert.match(
  chatContent,
  /scrollToIndex\(\{[\s\S]*index: location\.messageIndex/,
  "chat content should scroll the virtual list with the target data index",
);
assert.doesNotMatch(
  chatContent,
  /scrollToIndex\(\{[\s\S]*location\.firstItemIndex \+ location\.messageIndex/,
  "chat content should not pass the virtual firstItemIndex to scrollToIndex",
);
assert.match(
  chatContent,
  /\[history-location\] scroll-request/,
  "chat content should log the virtual list scroll request in development",
);
assert.match(
  chatContent,
  /isHistoryJumpingRef\.current = true;[\s\S]*?findMessageAndLoad\(message\)/,
  "chat content should lock automatic scrolling before awaiting history lookup",
);
assert.match(
  chatContent,
  /isHistoryJumping|historyJumping/,
  "chat content should track an active history jump separately from the target id",
);
assert.match(
  chatContent,
  /followOutput=\{\(isAtBottom\) =>[\s\S]*!isHistoryJumping[\s\S]*false/,
  "chat content should disable automatic follow output during a history jump",
);
assert.match(
  chatContent,
  /const loadMoreMessage = \(\) => \{\s*\n\s*if \(isHistoryJumpingRef\.current\) return;\s*\n\s*if \(!loadState\.hasMoreOld \|\| moreOldLoading\) return;/,
  "chat content should not load more history while a jump is pending",
);
assert.match(
  chatContent,
  /bottomScrollTimer\.current = window\.setTimeout\(\(\) => \{[\s\S]*?if \(isHistoryJumpingRef\.current\) return;[\s\S]*?index: 9999/,
  "queued bottom scrolling should recheck the history jump before running",
);
assert.match(
  chatContent,
  /window\.requestAnimationFrame\(\(\) => \{\s*\n\s*stickyScrollFrame\.current = undefined;\s*\n\s*if \(isHistoryJumpingRef\.current\) return;[\s\S]*?index: 9999/,
  "queued sticky scrolling should recheck the history jump before running",
);
assert.match(
  chatContent,
  /historyJumpUnlockTimer|clearTimeout\(historyJumpUnlockTimer/,
  "history location should keep its scroll lock briefly after the target renders",
);
assert.match(
  chatContent,
  /itemsRendered=\{\(items\) => \{[\s\S]*?element\.classList\.add\("animate-pulse"\)[\s\S]*?setTimeout\(/,
  "history location should highlight the target without immediately unlocking scrolling",
);
assert.match(
  chatContent,
  /itemsRendered=\{\(items\) => \{[\s\S]*pendingJumpClientMsgID\.current[\s\S]*getElementById\(`/,
  "chat content should highlight a quoted message after Virtuoso renders it",
);
assert.doesNotMatch(
  chatContent,
  /attempts\+\+ < 30|attempts < 30/,
  "chat content should not treat a fixed frame budget as a failed history location",
);
assert.doesNotMatch(
  chatContent,
  /element\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/,
  "chat content should not rely on DOM scrolling for a virtualized target",
);
assert.match(
  chatContent,
  /feedbackToast\(\{ error: new Error\(t\("toast\.messageLocationFailed"\)\) \}\)/,
  "chat content should notify the user when message location fails",
);
assert.match(
  chatContent,
  /try \{[\s\S]*?findMessageAndLoad\(message\)[\s\S]*?catch \(error\)[\s\S]*?feedbackToast\(\{ error: new Error\(t\("toast\.messageLocationFailed"\)\) \}\)/,
  "chat content should notify the user when history location throws",
);
assert.match(
  storage,
  /markManualLogout|shouldSkipAutoLogin/,
  "storage should expose the current-session manual logout state",
);
assert.match(
  loginForm,
  /shouldSkipAutoLogin\(\)/,
  "login form should skip startup auto-login after manual logout",
);
assert.match(
  loginForm,
  /consumeStartupAutoLogin\(\)/,
  "login form should consume startup auto-login only once per app run",
);
assert.match(
  mainContentWrap,
  /clearManualLogout\(\)/,
  "a new app session should clear the previous session's manual logout marker",
);
assert.match(
  userStore,
  /userLogout: async \(force\?: boolean, manual\?: boolean\)/,
  "user logout should distinguish manual logout from passive cleanup",
);
assert.match(
  userStore,
  /if \(manual\) markManualLogout\(\)/,
  "only manual logout should set the skip-auto-login marker",
);
assert.match(
  leftNavBar,
  /userLogout\(false, true\)/,
  "the avatar logout action should mark a manual logout",
);

console.log("historyJumpAndManualLogout tests passed");
