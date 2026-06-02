import axios from "axios";
import { t } from "i18next";
import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/store";

import { getChatToken, getIMToken } from "./storage";
import { feedbackToast } from "./common";
import { getServerHost } from "./config";

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
let _apiAxios: ReturnType<typeof createAxiosInstance> | null = null;

export const getChatAxios = () => {
  const host = getServerHost();
  const url = `http://${host}:10008`;
  if (!_chatAxios || _chatAxios.defaults.baseURL !== url) {
    _chatAxios = createAxiosInstance(url, false);
  }
  return _chatAxios;
};

export const getApiAxios = () => {
  const host = getServerHost();
  const url = `http://${host}:10002`;
  if (!_apiAxios || _apiAxios.defaults.baseURL !== url) {
    _apiAxios = createAxiosInstance(url, true);
  }
  return _apiAxios;
};

export default createAxiosInstance;
