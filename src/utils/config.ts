const IM_HOST_KEY = "openim_im_host";
const CHAT_HOST_KEY = "openim_chat_host";

/** Get the configured IM server host, with .env fallback */
export function getIMHost(): string {
  const stored = localStorage.getItem(IM_HOST_KEY);
  if (stored) return stored;
  return (import.meta.env.VITE_IM_HOST ?? import.meta.env.VITE_BASE_HOST) as string;
}

export function setIMHost(host: string): void {
  localStorage.setItem(IM_HOST_KEY, host);
}

/** Get the configured Chat server host, with .env fallback */
export function getChatHost(): string {
  const stored = localStorage.getItem(CHAT_HOST_KEY);
  if (stored) return stored;
  return (import.meta.env.VITE_CHAT_HOST ?? import.meta.env.VITE_BASE_HOST) as string;
}

export function setChatHost(host: string): void {
  localStorage.setItem(CHAT_HOST_KEY, host);
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
