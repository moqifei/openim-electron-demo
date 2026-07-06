import * as localForage from "localforage";

import type { DigitalTwinConfig } from "@/api/digitalTwin";

const DIGITAL_TWIN_CONFIG_PREFIX = "IM_DIGITAL_TWIN_CONFIG:";

const configKey = (userID: string) => `${DIGITAL_TWIN_CONFIG_PREFIX}${userID}`;

export const setCachedDigitalTwinConfig = (
  userID: string,
  config: DigitalTwinConfig,
) => {
  if (!userID) return Promise.resolve();
  return localForage.setItem(configKey(userID), config);
};

export const getCachedDigitalTwinConfig = async (userID: string) => {
  if (!userID) return undefined;
  return (await localForage.getItem<DigitalTwinConfig>(configKey(userID))) ?? undefined;
};

export const clearCachedDigitalTwinConfig = (userID: string) => {
  if (!userID) return Promise.resolve();
  return localForage.removeItem(configKey(userID));
};
