import { expect, test } from "@playwright/test";
import fs from "node:fs";
import ts from "typescript";

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

test("finishes and releases the previous SDK session before returning to login", async () => {
  const calls: string[] = [];
  let finishSdkLogout!: () => void;
  let finishSdkUninit!: () => void;
  const sdkLogout = new Promise<void>((resolve) => (finishSdkLogout = resolve));
  const sdkUninit = new Promise<void>((resolve) => (finishSdkUninit = resolve));
  const state = {
    getState: () => ({ clearContactStore: () => calls.push("clear contacts") }),
  };
  const modules: Record<string, unknown> = {
    i18next: { t: (key: string) => key },
    zustand: {
      create: () => (initialize: Function) => {
        let store: Record<string, unknown> = {};
        const set = (update: unknown) => {
          Object.assign(store, typeof update === "function" ? update(store) : update);
        };
        store = initialize(set, () => store);
        return { getState: () => store };
      },
    },
    "@/api/login": {
      logoutSession: async () => calls.push("server logout"),
    },
    "@/api/organization": {},
    "@/layout/MainContentWrap": {
      IMSDK: {
        logout: () => {
          calls.push("sdk logout");
          return sdkLogout;
        },
        unInitSDK: () => {
          calls.push("sdk uninit");
          return sdkUninit;
        },
      },
    },
    "@/routes": { default: { navigate: () => calls.push("navigate") } },
    "@/utils/common": { feedbackToast: () => undefined },
    "@/utils/screenshotShortcut": { DEFAULT_SCREENSHOT_SHORTCUT: "" },
    "@/utils/storage": {
      getLocale: () => "en-US",
      markManualLogout: () => calls.push("manual logout"),
      clearIMProfile: async () => calls.push("clear profile"),
    },
    "./contact": { useContactStore: state },
    "./conversation": {
      useConversationStore: {
        getState: () => ({
          clearConversationStore: () => calls.push("clear conversations"),
        }),
      },
    },
  };
  const source = ts.transpileModule(read("src/store/user.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", "window", source)(
    (name: string) => modules[name],
    exports,
    { electronAPI: {} },
  );
  const userStore = exports.useUserStore as {
    getState: () => { userLogout: (force: boolean, manual: boolean) => Promise<void> };
  };

  const logout = userStore.getState().userLogout(false, true);
  await new Promise(setImmediate);
  expect(calls).toEqual(["server logout", "sdk logout"]);

  finishSdkLogout();
  await new Promise(setImmediate);
  expect(calls).toEqual(["server logout", "sdk logout", "sdk uninit"]);

  finishSdkUninit();
  await logout;
  expect(calls).toEqual([
    "server logout",
    "sdk logout",
    "sdk uninit",
    "manual logout",
    "clear profile",
    "clear contacts",
    "clear conversations",
    "navigate",
  ]);
});
