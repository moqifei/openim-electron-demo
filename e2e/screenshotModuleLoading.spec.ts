import { expect, test } from "@playwright/test";
import fs from "node:fs";

const screenshotIpcSource = fs.readFileSync(
  "electron/main/ipcHandlerManage.ts",
  "utf8",
);

test("loads native screenshot packages through the ASAR-compatible CommonJS resolver", () => {
  expect(screenshotIpcSource).toContain('createRequire(__filename)');
  expect(screenshotIpcSource).not.toContain(
    'await import("electron-screenshots")',
  );
  expect(screenshotIpcSource).not.toContain(
    'await import("node-screenshots")',
  );
});
