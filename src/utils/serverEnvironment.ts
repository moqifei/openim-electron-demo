import serverEnvironmentConfig from "@/config/serverEnvironments.json";

import { getChatHost, getIMHost, hasManualServerHosts, setServerHosts } from "./config";

const SELECTED_ENVIRONMENT_KEY = "openim_server_environment";
const PROBE_CHANNEL = "probeServerEnvironment";

type ProbePorts = {
  im: number[];
  chat: number[];
};

export type ServerEnvironment = {
  key: string;
  name: string;
  imHost: string;
  chatHost: string;
};

type ProbeRequest = {
  environments: ServerEnvironment[];
  ports: ProbePorts;
  timeoutMs: number;
};

let selectionPromise: Promise<ServerEnvironment> | null = null;

const environments = serverEnvironmentConfig.environments as ServerEnvironment[];
const probePorts = serverEnvironmentConfig.probePorts as ProbePorts;
const probeTimeoutMs = serverEnvironmentConfig.probeTimeoutMs;

const orderedEnvironments = () => {
  if (!import.meta.env.DEV) return environments;

  const localEnvironment = environments.find(
    (environment) => environment.imHost === "127.0.0.1",
  );
  if (!localEnvironment) return environments;

  return [
    localEnvironment,
    ...environments.filter((environment) => environment !== localEnvironment),
  ];
};

const fallbackEnvironment = (): ServerEnvironment => {
  if (import.meta.env.DEV) {
    const localEnvironment = environments.find(
      (environment) => environment.imHost === "127.0.0.1",
    );
    if (localEnvironment) return localEnvironment;
  }

  const matched = environments.find(
    (env) => env.imHost === getIMHost() && env.chatHost === getChatHost(),
  );
  return matched ?? environments[0];
};

const manualEnvironment = (): ServerEnvironment => ({
  key: "manual",
  name: "manual",
  imHost: getIMHost(),
  chatHost: getChatHost(),
});

const applyEnvironment = (environment: ServerEnvironment) => {
  setServerHosts({
    imHost: environment.imHost,
    chatHost: environment.chatHost,
  });
  localStorage.setItem(SELECTED_ENVIRONMENT_KEY, environment.key);
};

const probeWithElectron = async (): Promise<ServerEnvironment | null> => {
  if (!window.electronAPI) return null;

  try {
    return await window.electronAPI.ipcInvoke<ServerEnvironment | null>(PROBE_CHANNEL, {
      environments: orderedEnvironments(),
      ports: probePorts,
      timeoutMs: probeTimeoutMs,
    } satisfies ProbeRequest);
  } catch (error) {
    console.error("probe server environment failed", error);
    return null;
  }
};

const probeByFetch = async (
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`http://${host}:${port}`, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

const probeWithRenderer = async (): Promise<ServerEnvironment | null> => {
  const results = await Promise.all(
    orderedEnvironments().map(async (environment) => {
      const checks = [
        ...probePorts.im.map((port) =>
          probeByFetch(environment.imHost, port, probeTimeoutMs),
        ),
        ...probePorts.chat.map((port) =>
          probeByFetch(environment.chatHost, port, probeTimeoutMs),
        ),
      ];
      const available = (await Promise.all(checks)).every(Boolean);
      return { environment, available };
    }),
  );

  return results.find((result) => result.available)?.environment ?? null;
};

export const ensureServerEnvironmentSelected = async (
  force = false,
): Promise<ServerEnvironment> => {
  if (hasManualServerHosts()) {
    return manualEnvironment();
  }

  if (selectionPromise && !force) return selectionPromise;

  selectionPromise = (async () => {
    const detected = (await probeWithElectron()) ?? (await probeWithRenderer());
    const selected = detected ?? fallbackEnvironment();
    applyEnvironment(selected);
    return selected;
  })();

  return selectionPromise;
};

export const getSelectedServerEnvironmentKey = () =>
  localStorage.getItem(SELECTED_ENVIRONMENT_KEY);
