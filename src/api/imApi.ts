import { v4 as uuidv4 } from "uuid";

import { getChatAxios } from "@/utils/request";
import { getChatToken } from "@/utils/storage";

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
