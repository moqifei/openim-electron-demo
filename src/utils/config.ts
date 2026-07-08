import serverEnvironmentConfig from "@/config/serverEnvironments.json";

const IM_HOST_KEY = "openim_im_host";
const CHAT_HOST_KEY = "openim_chat_host";
const MANUAL_SERVER_HOST_KEY = "openim_manual_server_host";
const SELECTED_SERVER_ENVIRONMENT_KEY = "openim_server_environment";

const getDefaultEnvironment = () => serverEnvironmentConfig.environments[0];

const getDefaultIMHost = () =>
  ((import.meta.env.VITE_IM_HOST ??
    import.meta.env.VITE_BASE_HOST ??
    getDefaultEnvironment()?.imHost) as string) ?? "";

const getDefaultChatHost = () =>
  ((import.meta.env.VITE_CHAT_HOST ??
    import.meta.env.VITE_BASE_HOST ??
    getDefaultEnvironment()?.chatHost) as string) ?? "";

/** Get the configured IM server host, with .env fallback */
export function getIMHost(): string {
  const stored = localStorage.getItem(IM_HOST_KEY);
  if (stored) return stored;
  return getDefaultIMHost();
}

export function setIMHost(host: string): void {
  localStorage.setItem(IM_HOST_KEY, host);
}

/** Get the configured Chat server host, with .env fallback */
export function getChatHost(): string {
  const stored = localStorage.getItem(CHAT_HOST_KEY);
  if (stored) return stored;
  return getDefaultChatHost();
}

export function setChatHost(host: string): void {
  localStorage.setItem(CHAT_HOST_KEY, host);
}

export function setServerHosts({
  imHost,
  chatHost,
}: {
  imHost: string;
  chatHost: string;
}): void {
  setIMHost(imHost);
  setChatHost(chatHost);
}

export function setManualServerHosts(hosts: {
  imHost: string;
  chatHost: string;
}): void {
  setServerHosts(hosts);
  localStorage.setItem(MANUAL_SERVER_HOST_KEY, "1");
  localStorage.removeItem(SELECTED_SERVER_ENVIRONMENT_KEY);
}

export function hasManualServerHosts(): boolean {
  if (localStorage.getItem(MANUAL_SERVER_HOST_KEY) === "1") return true;

  const hasStoredHosts =
    Boolean(localStorage.getItem(IM_HOST_KEY)) &&
    Boolean(localStorage.getItem(CHAT_HOST_KEY));
  const hasAutoSelectedEnvironment = Boolean(
    localStorage.getItem(SELECTED_SERVER_ENVIRONMENT_KEY),
  );

  return hasStoredHosts && !hasAutoSelectedEnvironment;
}

/** Backward-compatible alias */
export function getServerHost(): string {
  return getIMHost();
}

export function setServerHost(host: string): void {
  setIMHost(host);
}

export function clearServerHost(): void {
  localStorage.removeItem(IM_HOST_KEY);
  localStorage.removeItem(CHAT_HOST_KEY);
  localStorage.removeItem(MANUAL_SERVER_HOST_KEY);
  localStorage.removeItem(SELECTED_SERVER_ENVIRONMENT_KEY);
  // Also remove legacy key
  localStorage.removeItem("openim_server_host");
}

/** Derive URLs from the active hosts */
export function getServerUrls() {
  const imHost = getIMHost();
  const chatHost = getChatHost();
  return {
    wsUrl: `ws://${imHost}:10001`,
    apiUrl: `http://${imHost}:10002`,
    chatUrl: `http://${chatHost}:10008`,
  };
}
