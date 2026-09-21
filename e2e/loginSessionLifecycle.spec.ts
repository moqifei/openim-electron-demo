import { expect, test } from "@playwright/test";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("serializes profile replacement before the SDK can log in to a new server", () => {
  const storage = read("src/utils/storage.ts");
  const login = read("src/pages/login/LoginForm.tsx");
  const logout = read("src/store/user.ts");
  const startup = read("src/layout/MainContentWrap.tsx");

  expect(storage).toContain("export const setIMProfile = async");
  expect(storage).toContain("export const clearIMProfile = async");
  expect(login).toContain("await setIMProfile({ chatToken, imToken, userID })");
  expect(logout).toContain("await clearIMProfile()");
  expect(startup).toContain("await clearIMProfile()");
  expect(startup).toContain("sessionReady");
  expect(startup).not.toContain("finally {");
});

test("does not block a tray quit on a renderer-only logout acknowledgement", () => {
  const appManage = read("electron/main/appManage.ts");

  expect(appManage).not.toContain('app.on("before-quit"');
  expect(appManage).not.toContain("requestLogoutBeforeQuit");
});

test("does not send a previous server token with an anonymous login request", () => {
  const request = read("src/utils/request.ts");

  expect(request).toContain("const isLoginRequest =");
  expect(request).toContain("if (!isLoginRequest(config.url))");
});
