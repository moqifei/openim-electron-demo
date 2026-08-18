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
const DIGITAL_TWIN_TOKEN_KEY = "openim_digital_twin_token";

export const getDefaultIMHost = () =>
  ((import.meta.env.VITE_IM_HOST ??
    import.meta.env.VITE_BASE_HOST) as string) ?? "";

export const getDefaultChatHost = () =>
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

const IM_WS_PORT_KEY = "openim_im_ws_port";

/**
 * 返回 IM WebSocket 长连接端口。
 * 优先级：localStorage 用户配置 > 构建期环境变量 VITE_WS_PORT > 默认值 20001。
 * 默认 20001 为行内标准化部署端口（原 10001 因与日志服务冲突已弃用，仅作兜底）。
 */
export function getIMWsPort(): string {
  const stored = localStorage.getItem(IM_WS_PORT_KEY);
  if (stored) return stored;
  const fromEnv = import.meta.env.VITE_WS_PORT as string | undefined;
  if (fromEnv) return fromEnv;
  return "20001";
}

export function setIMWsPort(port: string): void {
  localStorage.setItem(IM_WS_PORT_KEY, port);
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
  // [修复] 仅当用户通过 ServerConfig 弹窗明确手动保存过地址时才跳过自动探测。
  // 之前逻辑：只要 localStorage 有 im+chat host 值且无 environment key 就判定为"手动配置"，
  // 导致探测流程写入的 host 残留也会被误判为手动，后续启动永远跳过探测，地址无法更新。
  return localStorage.getItem(MANUAL_SERVER_HOST_KEY) === "1";
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
  digitalTwinToken: string;
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
  digitalTwinToken?: string;
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
    digitalTwinToken:
      (env?.digitalTwinToken as string) ??
      (root.digitalTwinToken as string) ??
      "",
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

/** Digital twin auth token for Orange digital-twin reply API calls */
export function getDigitalTwinToken(): string {
  const stored = localStorage.getItem(DIGITAL_TWIN_TOKEN_KEY);
  if (stored !== null) return stored;
  return getDefaultPlazaConfig().digitalTwinToken;
}

export function setDigitalTwinToken(token: string): void {
  if (token) localStorage.setItem(DIGITAL_TWIN_TOKEN_KEY, token);
  else localStorage.removeItem(DIGITAL_TWIN_TOKEN_KEY);
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
  const wsPort = getIMWsPort();
  return {
    wsUrl: `ws://${imHost}:${wsPort}`,
    apiUrl: `http://${imHost}:10002`,
    chatUrl: `http://${chatHost}:10008`,
    plazaDirectMode: isPlazaDirectMode(),
    plazaUrl: getPlazaUrl(),
    orangeUrl: getOrangeUrl(),
    orangeToken: getOrangeToken(),
    digitalTwinToken: getDigitalTwinToken(),
  };
}
