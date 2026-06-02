const STORAGE_KEY = "openim_server_host";

/** Get the configured server host, with .env fallback */
export function getServerHost(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return import.meta.env.VITE_BASE_HOST as string;
}

export function setServerHost(host: string): void {
  localStorage.setItem(STORAGE_KEY, host);
}

export function clearServerHost(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Derive URLs from the active host */
export function getServerUrls() {
  const host = getServerHost();
  return {
    wsUrl: `ws://${host}:10001`,
    apiUrl: `http://${host}:10002`,
    chatUrl: `http://${host}:10008`,
  };
}
