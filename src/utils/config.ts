import serverEnvironmentConfig from "@/config/serverEnvironments.json";

const IM_HOST_KEY = "openim_im_host";
const CHAT_HOST_KEY = "openim_chat_host";
const MANUAL_SERVER_HOST_KEY = "openim_manual_server_host";
const SELECTED_SERVER_ENVIRONMENT_KEY = "openim_server_environment";

// --- SKILL Plaza direct-access keys ---
const PLAZA_DIRECT_MODE_KEY = "openim_plaza_direct_mode";
const PLAZA_URL_KEY = "openim_plaza_url";
const ORANGE_URL_KEY = "openim_orange_url";
const ORANGE_TOKEN_KEY = "openim_orange_token";

const getDefaultIMHost = () =>
  ((import.meta.env.VITE_IM_HOST ??
    import.meta.env.VITE_BASE_HOST) as string) ?? "";

const getDefaultChatHost = () =>
  ((import.meta.env.VITE_CHAT_HOST ??
    import.meta.env.VITE_BASE_HOST) as string) ?? "";

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

// --- SKILL Plaza direct-access config ---

// serverEnvironment 探测选中环境后写入的 localStorage key
const SELECTED_ENVIRONMENT_KEY = "openim_server_environment";

type PlazaDirectConfig = {
  plazaDirectMode: boolean;
  plazaUrl: string;
  orangeUrl: string;
  orangeToken: string;
};

// 单条环境定义：environments 数组中携带该环境专属的 orange/plaza 地址，
// 启动探测选中环境后由本模块解析，实现「一套构建自动适配多套环境」。
type ServerEnvEntry = {
  key: string;
  imHost?: string;
  chatHost?: string;
  plazaDirectMode?: boolean;
  plazaUrl?: string;
  orangeUrl?: string;
  orangeToken?: string;
};

function normalizeHost(h: string): string {
  return h.replace(/^https?:\/\//, "").replace(/:\d+$/, "").trim().toLowerCase();
}

function getEnvList(): ServerEnvEntry[] {
  const root = serverEnvironmentConfig as Record<string, unknown>;
  const list = root.environments;
  return Array.isArray(list) ? (list as ServerEnvEntry[]) : [];
}

/**
 * 解析当前激活环境（优先级）：
 *   1) 启动探测已选中的环境（serverEnvironment 写入的 openim_server_environment）；
 *   2) 按当前 IM host 反查；
 *   3) 首个环境；
 *   4) 无 environments 时返回 undefined，回落到旧的扁平字段（向后兼容）。
 */
function getActiveEnvEntry(): ServerEnvEntry | undefined {
  const list = getEnvList();
  if (list.length === 0) return undefined;

  const selectedKey = localStorage.getItem(SELECTED_ENVIRONMENT_KEY);
  const byKey = selectedKey ? list.find((e) => e.key === selectedKey) : undefined;
  if (byKey) return byKey;

  const im = getIMHost();
  const byHost = im
    ? list.find((e) => e.imHost && normalizeHost(e.imHost) === normalizeHost(im))
    : undefined;
  if (byHost) return byHost;

  return list[0];
}

function getDefaultPlazaConfig(): PlazaDirectConfig {
  const root = serverEnvironmentConfig as Record<string, unknown>;
  const env = getActiveEnvEntry();
  // 优先使用 environments 中选中环境的地址；无环境定义时回落到旧的扁平字段。
  return {
    plazaDirectMode: Boolean(env?.plazaDirectMode ?? root.plazaDirectMode),
    plazaUrl: (env?.plazaUrl as string) ?? (root.plazaUrl as string) ?? "",
    orangeUrl: (env?.orangeUrl as string) ?? (root.orangeUrl as string) ?? "",
    orangeToken:
      (env?.orangeToken as string) ?? (root.orangeToken as string) ?? "",
  };
}

/**
 * Whether to use client-direct plaza access (bypass chat proxy).
 * When true, the client calls llm-tools directly and uploads to Orange itself.
 */
export function isPlazaDirectMode(): boolean {
  const stored = localStorage.getItem(PLAZA_DIRECT_MODE_KEY);
  if (stored !== null) return stored === "1";
  return getDefaultPlazaConfig().plazaDirectMode;
}

export function setPlazaDirectMode(enabled: boolean): void {
  localStorage.setItem(PLAZA_DIRECT_MODE_KEY, enabled ? "1" : "0");
}

/** Direct plaza URL (e.g. http://llm-tools.qa.bx). Empty means use chat proxy. */
export function getPlazaUrl(): string {
  const stored = localStorage.getItem(PLAZA_URL_KEY);
  if (stored !== null) return stored;
  return getDefaultPlazaConfig().plazaUrl;
}

export function setPlazaUrl(url: string): void {
  if (url) localStorage.setItem(PLAZA_URL_KEY, url);
  else localStorage.removeItem(PLAZA_URL_KEY);
}

/** Orange base URL for direct skill install (e.g. http://127.0.0.1:37377) */
export function getOrangeUrl(): string {
  const stored = localStorage.getItem(ORANGE_URL_KEY);
  if (stored !== null) return stored;
  return getDefaultPlazaConfig().orangeUrl;
}

export function setOrangeUrl(url: string): void {
  if (url) localStorage.setItem(ORANGE_URL_KEY, url);
  else localStorage.removeItem(ORANGE_URL_KEY);
}

/** Orange auth token for direct skill install API calls */
export function getOrangeToken(): string {
  const stored = localStorage.getItem(ORANGE_TOKEN_KEY);
  if (stored !== null) return stored;
  return getDefaultPlazaConfig().orangeToken;
}

export function setOrangeToken(token: string): void {
  localStorage.setItem(ORANGE_TOKEN_KEY, token);
}

export function clearServerHost(): void {
  localStorage.removeItem(IM_HOST_KEY);
  localStorage.removeItem(CHAT_HOST_KEY);
  localStorage.removeItem(MANUAL_SERVER_HOST_KEY);
  localStorage.removeItem(SELECTED_SERVER_ENVIRONMENT_KEY);
  // Also clear plaza direct-access keys
  localStorage.removeItem(PLAZA_DIRECT_MODE_KEY);
  localStorage.removeItem(PLAZA_URL_KEY);
  localStorage.removeItem(ORANGE_URL_KEY);
  localStorage.removeItem(ORANGE_TOKEN_KEY);
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
    plazaDirectMode: isPlazaDirectMode(),
    plazaUrl: getPlazaUrl(),
    orangeUrl: getOrangeUrl(),
    orangeToken: getOrangeToken(),
  };
}
