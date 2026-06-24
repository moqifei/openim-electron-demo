import { v4 as uuidv4 } from "uuid";

import { getApiAxios, getChatAxios } from "@/utils/request";
import { getChatToken } from "@/utils/storage";
import { useUserStore } from "@/store";

const getRequest = () => getChatAxios();

export const getRtcConnectData = async (room: string, identity: string) => {
  const token = (await getChatToken()) as string;
  return getRequest().post<{ serverUrl: string; token: string }>(
    "/user/rtc/get_token",
    {
      room,
      identity,
    },
    {
      headers: {
        token,
        operationID: uuidv4(),
      },
    },
  );
};

export type ObjectUploadResp = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

export const markMsgsAsRead = async (params: {
  conversationID: string;
  seqs: number[];
  userID: string;
}) => getApiAxios().post<void>("/msg/mark_msgs_as_read", params);

export type GroupMessageReadInfo = {
  seq: number;
  hasReadCount: number;
  unreadCount: number;
  groupMemberCount: number;
  hasReadUserIDList: string[];
};

export const getGroupMessagesReadInfo = async (params: {
  conversationID: string;
  groupID?: string;
  userID: string;
  seqs: number[];
}) => getApiAxios().post<GroupMessageReadInfo[]>("/msg/get_group_messages_read_info", params);

export const uploadObjectFile = async (
  file: File,
  options?: {
    name?: string;
    contentType?: string;
    cause?: string;
  },
) => {
  const formData = new FormData();
  const rawName = options?.name ?? file.name;
  const currentUserID = useUserStore.getState()?.selfInfo?.userID;
  // Backend requires non-admin users to prefix file name with their userID
  const uploadName = currentUserID
    ? `${currentUserID}/${rawName}`
    : rawName;

  formData.append("file", file, uploadName);
  formData.append("name", uploadName);
  formData.append("contentType", options?.contentType ?? file.type);
  formData.append("cause", options?.cause ?? "chat");

  return getApiAxios().post<ObjectUploadResp>("/object/upload", formData, {
    timeout: 10 * 60 * 1000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
};
