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
  expect(item).toContain("onMouseEnter={handleMentionMouseEnter}");
  expect(item).toContain("onMouseLeave={handleMentionMouseLeave}");
  expect(item).toContain("profileWithMention");
  expect(item).toContain("onMouseEnter={() => setContentHovered(true)}");
  expect(item).toContain('aria-label={t("placeholder.mention")}');
  expect(styles).toContain(".avatarMentionButton");
  expect(styles).toContain(".profileWithMention");
  expect(styles).not.toContain("padding-left: 28px");
  expect(styles).toContain("width: 12px");
  expect(styles).toContain("height: 14px");
  expect(styles).toContain("left: -12px");
});
