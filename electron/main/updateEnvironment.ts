import os from "node:os";

export const SANDBOX_UPDATE_MESSAGE =
  "检测到新版本，当前沙箱环境内不支持自动升级，请到沙箱外升级后再使用";

export const isSandboxIPv4 = (address: string) => {
  const rawParts = address.split(".");
  if (rawParts.length !== 4 || rawParts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const parts = rawParts.map(Number);
  if (
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return parts[0] === 10 && parts[1] === 102 && parts[2] >= 240;
};

export const isSandboxEnvironment = () =>
  Object.values(os.networkInterfaces()).some((networkInterfaces) =>
    networkInterfaces?.some(
      (networkInterface) =>
        (networkInterface.family === "IPv4" || networkInterface.family === 4) &&
        isSandboxIPv4(networkInterface.address),
    ),
  );
