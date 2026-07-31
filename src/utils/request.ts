import axios from "axios";
import { t } from "i18next";
import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/store";

import { getChatToken, getIMToken } from "./storage";
import { feedbackToast } from "./common";
import { getIMHost, getChatHost } from "./config";
import {
  getPlazaUrl,
  getOrangeUrl,
  getOrangeToken,
} from "./config";

const tokenErrorCodeList = [1501, 1503, 1504, 1505];

const createAxiosInstance = (baseURL: string, imToken = true) => {
  const serves = axios.create({
    baseURL,
    timeout: 25000,
  });

  serves.interceptors.request.use(
    async (config) => {
      const token = imToken ? await getIMToken() : await getChatToken();
      config.headers.token = config.headers.token ?? token;
      config.headers.operationID = uuidv4();
      return config;
    },
    (err) => Promise.reject(err),
  );

  serves.interceptors.response.use(
    (res) => {
      if (tokenErrorCodeList.includes(res.data.errCode)) {
        feedbackToast({
          msg: t("toast.loginExpiration"),
          error: t("toast.loginExpiration"),
          onClose: () => {
            useUserStore.getState().userLogout(true);
          },
        });
      }
      if (res.data.errCode !== 0) {
        return Promise.reject(res.data);
      }
      return res.data;
    },
    (err) => {
      if (err.message.includes("timeout")) {
        console.error("error", err);
      }
      if (err.message.includes("Network Error")) {
        console.error("error", err);
      }
      return Promise.reject(err);
    },
  );

  return serves;
};

// Dynamic axios instances — re-read the base host from
// localStorage on each access so users can reconfigure at runtime.
let _chatAxios: ReturnType<typeof createAxiosInstance> | null = null;
let _botAxios: ReturnType<typeof createAxiosInstance> | null = null;
let _apiAxios: ReturnType<typeof createAxiosInstance> | null = null;

export const getChatAxios = () => {
  const chatHost = getChatHost();
  const url = `http://${chatHost}:10008`;
  if (!_chatAxios || _chatAxios.defaults.baseURL !== url) {
    _chatAxios = createAxiosInstance(url, false);
  }
  return _chatAxios;
};

export const getBotAxios = () => {
  const chatHost = getChatHost();
  const url = `http://${chatHost}:10010`;
  if (!_botAxios || _botAxios.defaults.baseURL !== url) {
    _botAxios = createAxiosInstance(url, false);
  }
  return _botAxios;
};

export const getApiAxios = () => {
  const imHost = getIMHost();
  const url = `http://${imHost}:10002`;
  if (!_apiAxios || _apiAxios.defaults.baseURL !== url) {
    _apiAxios = createAxiosInstance(url, true);
  }
  return _apiAxios;
};

// --- Plain axios (no token) for direct plaza / orange access ---

/**
 * Create a plain axios instance without IM/chat token auth.
 * Used for direct plaza API calls and Orange admin APIs that use Bearer tokens.
 */
const createPlainAxios = (baseURL: string, bearerToken?: string) => {
  const instance = axios.create({
    baseURL,
    timeout: 60000, // downloads may be slow
  });

  instance.interceptors.request.use((config) => {
    config.headers.operationID = uuidv4();
    if (bearerToken) {
      config.headers.Authorization = `Bearer ${bearerToken}`;
    }
    return config;
  });

  // Plaza returns raw data; Orange returns { errCode, data } like chat
  instance.interceptors.response.use(
    (res) => res.data,
    (err) => Promise.reject(err),
  );

  return instance;
};

let _plazaAxios: ReturnType<typeof createPlainAxios> | null = null;
let _orangeAxios: ReturnType<typeof createPlainAxios> | null = null;

/** Axios instance pointing directly at the SKILL plaza server (no token) */
export const getPlazaAxios = () => {
  const plazaUrl = getPlazaUrl();
  if (!plazaUrl) throw new Error("plaza URL not configured");
  if (!_plazaAxios || _plazaAxios.defaults.baseURL !== plazaUrl) {
    _plazaAxios = createPlainAxios(plazaUrl);
  }
  return _plazaAxios;
};

/** Axios instance pointing directly at Orange (Bearer token auth) */
export const getOrangeAxios = () => {
  const orangeUrl = getOrangeUrl();
  if (!orangeUrl) throw new Error("orange URL not configured");
  const token = getOrangeToken();
  if (!_orangeAxios || _orangeAxios.defaults.baseURL !== orangeUrl) {
    _orangeAxios = createPlainAxios(orangeUrl, token);
  }
  return _orangeAxios;
};

export default createAxiosInstance;
