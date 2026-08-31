import os from "node:os";

export const SANDBOX_UPDATE_MESSAGE =
  "检测到新版本，当前沙箱环境内不支持自动升级，请到沙箱外升级后再使用";

export const isSandboxIPv4 = (address: string) => {
  const normalizedAddress = address.trim().replace(/^::ffff:/i, "");
  const rawParts = normalizedAddress.split(".");
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

export const isSandboxEnvironment = (
  networkInterfaces = os.networkInterfaces(),
) =>
  Object.values(networkInterfaces).some((networkInterfaces) =>
    networkInterfaces?.some(
      (networkInterface) => isSandboxIPv4(networkInterface.address),
    ),
  );
