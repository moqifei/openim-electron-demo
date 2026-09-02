import { getWithRenderProcess } from "@openim/electron-client-sdk/lib/render";
import { AllowType } from "@openim/wasm-client-sdk";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useConversationStore, useUserStore } from "@/store";
import { emit } from "@/utils/events";
import {
  clearIMProfile,
  clearManualLogout,
  getIMToken,
  getIMUserID,
} from "@/utils/storage";

// const isElectronProd = import.meta.env.MODE !== "development" && window.electronAPI;

const { instance } = getWithRenderProcess({
  wasmConfig: {
    coreWasmPath: "./openIM.wasm",
    sqlWasmPath: "./sql-wasm.wasm",
  },
});
const openIMSDK = instance;

export const IMSDK = openIMSDK;

export const MainContentWrap = () => {
  const updateAppSettings = useUserStore((state) => state.updateAppSettings);

  const navigate = useNavigate();

  useEffect(() => {
    clearManualLogout();

    const loginCheck = async () => {
      // 启动时强制清除持久化的登录态, 确保每次启动客户端(包括系统重启后)
      // 都需要重新登录, 避免关机前未主动退出登录导致 token 残留、重启后免登录的安全风险。
      clearIMProfile();
      const IMToken = await getIMToken();
      const IMUserID = await getIMUserID();
      if (!IMToken || !IMUserID) {
        navigate("/login");
        return;
      }
    };

    loginCheck();
  }, []);

  useEffect(() => {
    window.userClick = (userID?: string, groupID?: string) => {
      if (!userID || userID === "AtAllTag") return;

      const currentGroupInfo = useConversationStore.getState().currentGroupInfo;

      if (groupID && currentGroupInfo?.lookMemberInfo === AllowType.NotAllowed) {
        return;
      }

      emit("OPEN_USER_CARD", {
        userID,
        groupID,
        isSelf: userID === useUserStore.getState().selfInfo.userID,
        notAdd:
          Boolean(groupID) &&
          currentGroupInfo?.applyMemberFriend === AllowType.NotAllowed,
      });
    };
  }, []);

  useEffect(() => {
    const initSettingStore = async () => {
      if (!window.electronAPI) return;
      updateAppSettings({
        closeAction:
          (await window.electronAPI?.ipcInvoke("getKeyStore", {
            key: "closeAction",
          })) || "miniSize",
      });
      window.electronAPI?.ipcInvoke("main-win-ready");
    };

    initSettingStore();
  }, []);

  return <Outlet />;
};
