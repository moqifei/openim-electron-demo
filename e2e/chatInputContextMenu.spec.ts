import { expect, test } from "@playwright/test";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("shows a focused editing menu for the chat input", () => {
  const footer = read("src/pages/chat/queryChat/ChatFooter/index.tsx");

  expect(footer).toContain("onContextMenu={handleEditorContextMenu}");
  expect(footer).toContain('data-testid="chat-input-context-menu"');
  expect(footer).toContain("data-testid={`chat-input-context-menu-${action}`}");
  expect(footer).toContain('action: "copy" as const');
  expect(footer).toContain('action: "paste" as const');
  expect(footer).toContain('action: "selectAll" as const');
  expect(footer).toContain('action: "cut" as const');
  expect(footer).toContain("navigator.clipboard.readText()");
});

test("keeps the send action anchored to the input panel bottom", () => {
  const footer = read("src/pages/chat/queryChat/ChatFooter/index.tsx");

  expect(footer).toMatch(
    /<div\s+onContextMenu=\{handleEditorContextMenu\}\s+className="flex min-h-0 flex-1 flex-col"/,
  );
});

test("exposes CKEditor operations used by the input editing menu", () => {
  const editor = read("src/components/CKEditor/index.tsx");

  expect(editor).toContain("hasSelection: () => boolean");
  expect(editor).toContain("hasContent: () => boolean");
  expect(editor).toContain("copySelection: () => void");
  expect(editor).toContain("cutSelection: () => void");
  expect(editor).toContain("selectAll: () => void");
  expect(editor).toContain("pasteText: (text: string) => void");
  expect(editor).toContain('document.execCommand("copy")');
  expect(editor).toContain('document.execCommand("cut")');
  expect(editor).toContain('editor.execute("selectAll")');
});
