import { LocaleString } from "@/store/type";
import * as localForage from "localforage";

localForage.config({
  name: "OpenCorp-Config",
});

export const setAreaCode = (areaCode: string) =>
  localStorage.setItem("IM_AREA_CODE", areaCode);
export const setPhoneNumber = (account: string) =>
  localStorage.setItem("IM_PHONE_NUM", account);
export const setEmail = (email: string) => localStorage.setItem("IM_EMAIL", email);
export const setLoginMethod = (method: string) =>
  localStorage.setItem("IM_LOGIN_METHOD", method);
export const setAdUsername = (username: string) =>
  localStorage.setItem("IM_AD_USERNAME", username);
export const getAdUsername = () => localStorage.getItem("IM_AD_USERNAME") ?? "";

const REMEMBERED_AD_PASSWORDS_KEY = "IM_AD_REMEMBERED_PASSWORDS";

const getRememberedAdPasswords = (): Record<string, string> => {
  try {
    const value = localStorage.getItem(REMEMBERED_AD_PASSWORDS_KEY);
    if (!value) return {};
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>(
      (passwords, [username, password]) => {
        if (typeof password === "string") passwords[username] = password;
        return passwords;
      },
      {},
    );
  } catch {
    return {};
  }
};

export const getRememberedAdLogin = (username: string) => {
  const password = username ? getRememberedAdPasswords()[username] ?? "" : "";
  return {
    password,
    rememberPassword: Boolean(password),
  };
};

export const saveRememberedAdLogin = (
  username: string,
  password: string,
  rememberPassword: boolean,
) => {
  if (!username) return;
  const passwords = getRememberedAdPasswords();
  if (rememberPassword) {
    passwords[username] = password;
  } else {
    delete passwords[username];
  }

  if (Object.keys(passwords).length > 0) {
    localStorage.setItem(REMEMBERED_AD_PASSWORDS_KEY, JSON.stringify(passwords));
  } else {
    localStorage.removeItem(REMEMBERED_AD_PASSWORDS_KEY);
  }
};

export const setTMToken = (token: string) => localForage.setItem("IM_TOKEN", token);
export const setChatToken = (token: string) =>
  localForage.setItem("IM_CHAT_TOKEN", token);
export const setTMUserID = (userID: string) => localForage.setItem("IM_USERID", userID);
export const setIMProfile = ({
  chatToken,
  imToken,
  userID,
}: {
  chatToken: string;
  imToken: string;
  userID: string;
}) => {
  setTMToken(imToken);
  setChatToken(chatToken);
  setTMUserID(userID);
};

export const setLocale = (locale: string) => localStorage.setItem("IM_LOCALE", locale);

export const clearIMProfile = () => {
  localForage.removeItem("IM_TOKEN");
  localForage.removeItem("IM_CHAT_TOKEN");
  localForage.removeItem("IM_USERID");
};

export const getAreaCode = () => localStorage.getItem("IM_AREA_CODE");
export const getPhoneNumber = () => localStorage.getItem("IM_PHONE_NUM");
export const getEmail = () => localStorage.getItem("IM_EMAIL");
export const getLoginMethod = () =>
  (localStorage.getItem("IM_LOGIN_METHOD") ?? "phone") as "phone" | "email";
export const getIMToken = async () => await localForage.getItem("IM_TOKEN");
export const getChatToken = async () => await localForage.getItem("IM_CHAT_TOKEN");
export const getIMUserID = async () => await localForage.getItem("IM_USERID");

export const getLocale = (): LocaleString =>
  window.electronAPI?.ipcSendSync("getKeyStoreSync", { key: "language" }) ||
  (localStorage.getItem("IM_LOCALE") as LocaleString) ||
  window.navigator.language ||
  "en-US";
