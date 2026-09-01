import net from "node:net";
import os from "node:os";

import serverEnvironmentConfig from "../../src/config/serverEnvironments.json";

export const SANDBOX_UPDATE_MESSAGE =
  "检测到新版本，当前沙箱环境内不支持自动升级，请到沙箱外升级后再使用";

const testEnvironment = serverEnvironmentConfig.environments.find(
  (environment) => environment.key === "test",
);
const testImHost = testEnvironment?.imHost ?? "";
const testImPorts = serverEnvironmentConfig.probePorts.im;
const probeTimeoutMs = serverEnvironmentConfig.probeTimeoutMs;

type SandboxEnvironmentOptions = {
  networkInterfaces?: ReturnType<typeof os.networkInterfaces>;
  canReachTestIm?: (
    host: string,
    ports: number[],
    timeoutMs: number,
  ) => Promise<boolean>;
};

const probeTcpPort = (host: string, port: number, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });

const canReachConfiguredTestIm = async (
  host: string,
  ports: number[],
  timeoutMs: number,
) => (await Promise.all(ports.map((port) => probeTcpPort(host, port, timeoutMs)))).some(Boolean);

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

  return (
    parts[0] === 10 &&
    parts[1] === 138 &&
    parts[2] >= 160 &&
    parts[2] <= 175
  );
};

export const isSandboxEnvironment = async ({
  networkInterfaces = os.networkInterfaces(),
  canReachTestIm = canReachConfiguredTestIm,
}: SandboxEnvironmentOptions = {}) => {
  const hasSandboxIp = Object.values(networkInterfaces).some((interfaces) =>
    interfaces?.some((networkInterface) =>
      isSandboxIPv4(networkInterface.address),
    ),
  );

  if (!hasSandboxIp || !testImHost || !testImPorts.length) return false;

  return canReachTestIm(testImHost, testImPorts, probeTimeoutMs);
};
