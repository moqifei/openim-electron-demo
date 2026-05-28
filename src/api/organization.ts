import { v4 as uuidv4 } from "uuid";

import createAxiosInstance from "@/utils/request";
import { getChatToken } from "@/utils/storage";

const request = createAxiosInstance(import.meta.env.VITE_CHAT_URL as string);

export interface ADDepartmentInfo {
  departmentID: string;
  name: string;
  parentID: string;
  memberCount: number;
  subDepartmentCount: number;
  level: number;
}

export interface ADDepartmentMemberInfo {
  userID: string;
  username: string;
  nickname: string;
  displayName: string;
  email: string;
  departmentID: string;
  position: string;
  phone: string;
}

export interface GetADDepartmentListResp {
  departments: ADDepartmentInfo[];
}

export interface GetADDepartmentMembersReq {
  departmentID: string;
  pagination: {
    pageNumber: number;
    showNumber: number;
  };
}

export interface GetADDepartmentMembersResp {
  members: ADDepartmentMemberInfo[];
  total: number;
}

export interface SearchADMembersReq {
  keyword: string;
  departmentID?: string;
  pagination: {
    pageNumber: number;
    showNumber: number;
  };
}

export interface SearchADMembersResp {
  members: ADDepartmentMemberInfo[];
  total: number;
}

export const getADDepartmentList = async () => {
  const token = (await getChatToken()) as string;
  return request.post<GetADDepartmentListResp>(
    "/ad/department/list",
    {},
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

export const getADDepartmentMembers = async (params: GetADDepartmentMembersReq) => {
  const token = (await getChatToken()) as string;
  return request.post<GetADDepartmentMembersResp>(
    "/ad/department/members",
    params,
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

export const searchADMembers = async (params: SearchADMembersReq) => {
  const token = (await getChatToken()) as string;
  return request.post<SearchADMembersResp>(
    "/ad/member/search",
    params,
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

export const syncADOrganization = async () => {
  const token = (await getChatToken()) as string;
  return request.post(
    "/ad/sync",
    {},
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};
