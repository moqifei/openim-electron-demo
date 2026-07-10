import type { MessageReceiveOptType } from "@openim/wasm-client-sdk";
import { useMutation } from "react-query";
import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/store";
import { getBotAxios, getChatAxios } from "@/utils/request";
import { getChatToken } from "@/utils/storage";

import { errorHandle } from "./errorHandle";

const platform = window.electronAPI?.getPlatform() ?? 5;

const getAreaCode = (code?: string) =>
  code ? (code.includes("+") ? code : `+${code}`) : code;

// Send verification code
export const useSendSms = () => {
  return useMutation(
    (params: API.Login.SendSmsParams) =>
      getChatAxios().post(
        "/account/code/send",
        {
          ...params,
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// Verify mobile phone number
export const useVerifyCode = () => {
  return useMutation(
    (params: API.Login.VerifyCodeParams) =>
      getChatAxios().post(
        "/account/code/verify",
        {
          ...params,
          areaCode: getAreaCode(params.areaCode),
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// register
export const useRegister = () => {
  return useMutation(
    (params: API.Login.DemoRegisterType) =>
      getChatAxios().post<{ chatToken: string; imToken: string; userID: string }>(
        "/account/register",
        {
          ...params,
          user: {
            ...params.user,
            areaCode: getAreaCode(params.user.areaCode),
          },
          platform,
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// reset passwords
export const useReset = () => {
  return useMutation(
    (params: API.Login.ResetParams) =>
      getChatAxios().post(
        "/account/password/reset",
        {
          ...params,
          areaCode: getAreaCode(params.areaCode),
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// change password
export const modifyPassword = async (params: API.Login.ModifyParams) => {
  const token = (await getChatToken()) as string;
  return getChatAxios().post(
    "/account/password/change",
    {
      ...params,
    },
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

// log in
export const useLogin = () => {
  return useMutation(
    (params: API.Login.LoginParams) =>
      getChatAxios().post<{ chatToken: string; imToken: string; userID: string }>(
        "/account/login",
        {
          ...params,
          platform,
          areaCode: getAreaCode(params.areaCode),
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// AD login
export const useADLogin = () => {
  return useMutation(
    (params: API.Login.AdLoginParams) =>
      getChatAxios().post<{ chatToken: string; imToken: string; userID: string }>(
        "/account/login/ad",
        {
          ...params,
          platform,
        },
        {
          headers: {
            operationID: uuidv4(),
          },
        },
      ),
    {
      onError: errorHandle,
    },
  );
};

// Get user information
export interface BusinessUserInfo {
  userID: string;
  password: string;
  account: string;
  phoneNumber: string;
  areaCode: string;
  email: string;
  nickname: string;
  faceURL: string;
  gender: number;
  level: number;
  birth: number;
  allowAddFriend: BusinessAllowType;
  allowBeep: BusinessAllowType;
  allowVibration: BusinessAllowType;
  globalRecvMsgOpt: MessageReceiveOptType;
}

export enum BusinessAllowType {
  Allow = 1,
  NotAllow = 2,
}

export const getBusinessUserInfo = async (userIDs: string[]) => {
  const token = (await getChatToken()) as string;
  return getChatAxios().post<{ users: BusinessUserInfo[] }>(
    "/user/find/full",
    {
      userIDs,
    },
    {
      headers: {
        operationID: uuidv4(),
        token,
      },
    },
  );
};

export const searchBusinessUserInfo = async (keyword: string) => {
  const token = (await getChatToken()) as string;
  return getChatAxios().post<{ total: number; users: BusinessUserInfo[] }>(
    "/user/search/full",
    {
      keyword,
      pagination: {
        pageNumber: 1,
        showNumber: 1,
      },
    },
    {
      headers: {
        operationID: uuidv4(),
        token,
      },
    },
  );
};

// Agent / bot search — search users with registerType=2 (admin-created notification accounts)
// AD-synced users have registerType=3, so we filter to only show admin-created agents
export interface AgentInfo {
  userID: string;
  nickname: string;
  faceURL: string;
  registerType: number;
  platformID?: number;
}

// Register type constants matching the backend
const REGISTER_TYPE_PHONE = 0;      // Phone registration
const REGISTER_TYPE_EMAIL = 1;      // Email registration  
const REGISTER_TYPE_ADMIN = 2;      // Admin/notification account (our agents)
const REGISTER_TYPE_AD = 3;         // AD synchronized users

export const searchAgents = async (
  keyword: string,
  pagination = {
    pageNumber: 1,
    showNumber: 200,
  },
) => {
  const token = (await getChatToken()) as string;
  // Use chat-api's /user/search/full endpoint to search all users
  // normal: 1 = exclude blocked users, 0 = include all users
  // Then filter by registerType === 2 (admin-created notification accounts)
  // The axios interceptor returns res.data which has shape: { errCode, errMsg, data: { total, users } }
  const response = await getChatAxios().post<{
    data: {
      total: number;
      users: AgentInfo[];
    };
  }>(
    "/user/search/full",
    {
      keyword,
      pagination,
      normal: 1, // Exclude blocked/forbidden users
    },
    {
      headers: {
        operationID: uuidv4(),
        token,
      },
    },
  );
  // Filter to only include admin-created users (registerType === 2)
  // These are the notification accounts created via admin panel (not AD-synced)
  const responseData = (response as unknown as { data: { total: number; users: AgentInfo[] } }).data;
  const allUsers = responseData?.users || [];
  const agents = allUsers.filter((user) => user.registerType === REGISTER_TYPE_ADMIN);
  return {
    data: {
      total: agents.length,
      users: agents,
    },
  };
};

interface UpdateBusinessUserInfoParams {
  email: string;
  nickname: string;
  faceURL: string;
  gender: number;
  birth: number;
  allowAddFriend: number;
  allowBeep: number;
  allowVibration: number;
  globalRecvMsgOpt: number;
}

export const updateBusinessUserInfo = async (
  params: Partial<UpdateBusinessUserInfoParams>,
) => {
  const token = (await getChatToken()) as string;
  return getChatAxios().post<unknown>(
    "/user/update",
    {
      ...params,
      userID: useUserStore.getState().selfInfo?.userID,
    },
    {
      headers: {
        operationID: uuidv4(),
        token,
      },
    },
  );
};
