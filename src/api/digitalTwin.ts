import { v4 as uuidv4 } from "uuid";

import {
  getCachedDigitalTwinConfig,
  setCachedDigitalTwinConfig,
} from "@/utils/digitalTwinStorage";
import { getChatAxios, getPlazaAxios, getOrangeAxios } from "@/utils/request";
import { getChatToken } from "@/utils/storage";

export type DigitalTwinConfig = {
  enabled: boolean;
  replyText?: string;
  prompt?: string;
  replyCooldownSeconds?: number;
  triggerMode?: DigitalTwinTriggerMode;
  unreadTimeoutSeconds?: number;
  replySchedule?: DigitalTwinReplySchedule;
  allowedSenderUserIDs?: string[];
  blockedSenderUserIDs?: string[];
  /** 知识库能力配置 */
  knowledgeBase?: DigitalTwinKnowledgeBaseConfig;
  version?: number;
  updatedAt?: number;
};

export type DigitalTwinTriggerMode = "immediate" | "manual" | "unread_timeout";

export type DigitalTwinReplySchedule = {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  timezone?: string;
};

// ── 知识库相关类型 ──────────────────────────────────────────────

/** 知识空间（Wiki Space）—— 来自 Arkon 知识库 */
export type WikiSpace = {
  spaceId: string;
  name: string;
  description: string;
  documentCount: number;
  tags: string[];
  createdAt: string;
};

/** Wiki 索引条目（某空间下的文档目录） */
export type WikiIndexEntry = {
  docId: string;
  title: string;
  path: string;
  tags: string[];
  updatedAt: string;
};

/** 某空间的完整 Wiki 索引 */
export type WikiIndex = {
  spaceId: string;
  name: string;
  index: WikiIndexEntry[];
};

/** 知识语义搜索结果条目 */
export type KnowledgeSearchResult = {
  searchId: string;
  docId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  snippet: string;
  relevanceScore: number;
  tags: string[];
  searchedAt: string;
};

/** 知识语义搜索响应 */
export type KnowledgeSearchResponse = {
  query: string;
  total: number;
  results: KnowledgeSearchResult[];
};

// ── 知识库配置类型 ────────────────────────────────────────────

/** 回答策略枚举 */
export type KnowledgeAnswerStrategy =
  | "auto_search"         // 仅知识型问题查（LLM 判断是否查库，推荐）
  | "knowledge_only";     // 自动查知识库（每次都强制搜索）

/** 知识库能力配置 */
export type DigitalTwinKnowledgeBaseConfig = {
  /** 是否启用知识库增强 */
  enabled: boolean;
  /** 关联的知识空间 ID 列表（当前检索不支持按空间过滤，仅作记录） */
  spaceIds: string[];
  /** 回答策略 */
  answerStrategy: KnowledgeAnswerStrategy;
  /**
   * 相似度阈值（0~1）。搜索结果相似度 >= 该值时，触发「读取 Wiki 正文」
   * （aiknowledge-read-wiki-page）并在引用条目中挂上详情。
   * 不填则使用服务端兜底配置（orange 静态配置，默认 0.8）。
   */
  similarityThreshold?: number;
  /**
   * 搜索返回的最大条数。不填则使用服务端兜底配置（默认 5）。
   */
  searchLimit?: number;
};

export type DigitalTwinConfigPatch = {
  enabled?: boolean;
  replyText?: string;
  prompt?: string;
  replyCooldownSeconds?: number;
  triggerMode?: DigitalTwinTriggerMode;
  unreadTimeoutSeconds?: number;
  replySchedule?: DigitalTwinReplySchedule;
  allowedSenderUserIDs?: string[];
  blockedSenderUserIDs?: string[];
  knowledgeBase?: DigitalTwinKnowledgeBaseConfig;
};

export type DigitalTwinConfigResponse = {
  userID: string;
  config: DigitalTwinConfig;
};

export type DigitalTwinReplyTrace = {
  source?: string;
  protocolSource?: string;
  finalizeSource?: string;
  metadata?: Record<string, unknown>;
};

export type DigitalTwinReplyRecord = {
  ownerUserID: string;
  senderUserID: string;
  triggerServerMsgID?: string;
  triggerClientMsgID?: string;
  operationID?: string;
  messageContent?: string;
  replyText: string;
  replySource: string;
  configSource?: string;
  generatorError?: string;
  trace?: DigitalTwinReplyTrace;
  createdAt: number;
  reviewStatus?: DigitalTwinReplyReviewStatus;
  reviewNote?: string;
  reviewedAt?: number;
};

export type DigitalTwinReplyReviewStatus = "confirmed" | "needs_follow_up";
export type DigitalTwinReplyListReviewStatus =
  | ""
  | "unreviewed"
  | DigitalTwinReplyReviewStatus;

export type DigitalTwinReplyListResponse = {
  userID: string;
  records: DigitalTwinReplyRecord[];
  hasMore?: boolean;
  nextCursor?: number;
  summary?: DigitalTwinReplySummary;
};

export type DigitalTwinReplySummary = {
  total: number;
  unreviewed: number;
  needsFollowUp: number;
  confirmed: number;
};

export type DigitalTwinUnreadTimeoutSummary = {
  pending: number;
};

export type DigitalTwinUnreadTimeoutSummaryResponse = {
  userID: string;
  summary: DigitalTwinUnreadTimeoutSummary;
};

export type DigitalTwinOverviewResponse = {
  userID: string;
  config: DigitalTwinConfig;
  replySummary: DigitalTwinReplySummary;
  unreadTimeoutSummary: DigitalTwinUnreadTimeoutSummary;
  latestReplies: DigitalTwinReplyRecord[];
};

export type DigitalTwinReplyReviewResponse = {
  userID: string;
  operationID: string;
  status: DigitalTwinReplyReviewStatus;
};

export type DigitalTwinSkillGenerateResponse = {
  userID: string;
  skillName: string;
  skillPath: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

// --- Async skill-generation task types ---

export type SkillGenerateTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type SkillGenerateTask = {
  id: string;
  status: SkillGenerateTaskStatus;
  owner_user_id: string;
  skill_name: string;
  skill_path?: string;
  skill_content?: string;
  source?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
};

export type DigitalTwinSkillGenerateAcceptResponse = {
  task_id: string;
  status: string;
  message: string;
};

export type DigitalTwinSkillSummary = {
  name: string;
  description?: string;
  skillPath?: string;
  updatedAt?: number;
  /** Full SKILL.md file content (frontmatter + body) */
  content?: string;
};

export type DigitalTwinSkillListResponse = {
  userID: string;
  skills: DigitalTwinSkillSummary[];
};

export type DigitalTwinSkillDeleteResponse = {
  userID: string;
  skillName: string;
  deleted: boolean;
  skillPath?: string;
};

// --- SKILL Plaza (企业技能广场) ---

export type PlazaSkillItem = {
  name: string;
  author: string;
  description: string;
  downloads: number;
  skill_type: string;
  thumbs_ups: number;
};

export type PlazaSkillListResponse = {
  skills: PlazaSkillItem[];
};

export type PlazaInstallResponse = {
  userID: string;
  skillName: string;
  installed: boolean;
  message?: string;
};

const withChatAuth = async () => ({
  headers: {
    token: (await getChatToken()) as string,
    operationID: uuidv4(),
  },
});

export const getDigitalTwinConfig = async () => {
  const response = await getChatAxios().post<DigitalTwinConfigResponse>(
    "/digital_twin/config/get",
    {},
    await withChatAuth(),
  );
  await setCachedDigitalTwinConfig(response.data.userID, response.data.config);
  return response;
};

export const updateDigitalTwinConfig = async (patch: DigitalTwinConfigPatch) => {
  const response = await getChatAxios().post<DigitalTwinConfigResponse>(
    "/digital_twin/config/update",
    patch,
    await withChatAuth(),
  );
  await setCachedDigitalTwinConfig(response.data.userID, response.data.config);
  return response;
};

export const listDigitalTwinReplies = async (
  limit = 5,
  reviewStatus: DigitalTwinReplyListReviewStatus = "",
  beforeCreatedAt = 0,
  senderUserID = "",
) =>
  getChatAxios().post<DigitalTwinReplyListResponse>(
    "/digital_twin/replies/list",
    { limit, reviewStatus, beforeCreatedAt, senderUserID },
    await withChatAuth(),
  );

export const reviewDigitalTwinReply = async (
  operationID: string,
  status: DigitalTwinReplyReviewStatus,
  note = "",
) =>
  getChatAxios().post<DigitalTwinReplyReviewResponse>(
    "/digital_twin/replies/review",
    { operationID, status, note },
    await withChatAuth(),
  );

export const getDigitalTwinUnreadTimeoutSummary = async () =>
  getChatAxios().post<DigitalTwinUnreadTimeoutSummaryResponse>(
    "/digital_twin/unread_timeout/summary",
    {},
    await withChatAuth(),
  );

export const getDigitalTwinOverview = async () => {
  const response = await getChatAxios().post<DigitalTwinOverviewResponse>(
    "/digital_twin/overview",
    {},
    await withChatAuth(),
  );
  await setCachedDigitalTwinConfig(response.data.userID, response.data.config);
  return response;
};

export const generateDigitalTwinSkill = async (
  skillName: string,
  description: string,
) =>
  getChatAxios().post<DigitalTwinSkillGenerateAcceptResponse>(
    "/digital_twin/skills/generate",
    { skillName, description },
    await withChatAuth(),
  );

export const getSkillGenerateTaskStatus = async (taskId: string) =>
  getChatAxios().post<SkillGenerateTask>(
    `/digital_twin/skills/tasks/${taskId}`,
    {},
    await withChatAuth(),
  );

export const listDigitalTwinSkills = async () =>
  getChatAxios().post<DigitalTwinSkillListResponse>(
    "/digital_twin/skills/list",
    {},
    await withChatAuth(),
  );

export type DigitalTwinSkillDetailResponse = {
  userID: string;
  name: string;
  description?: string;
  skillPath?: string;
  updatedAt?: number;
  /** Full SKILL.md file content (frontmatter + body) */
  content: string;
};

/** Fetch the full SKILL.md content of a single installed skill on demand. */
export const getDigitalTwinSkill = async (skillName: string) =>
  getChatAxios().post<DigitalTwinSkillDetailResponse>(
    "/digital_twin/skills/get",
    { skillName },
    await withChatAuth(),
  );

export const deleteDigitalTwinSkill = async (skillName: string) =>
  getChatAxios().post<DigitalTwinSkillDeleteResponse>(
    "/digital_twin/skills/delete",
    { skillName },
    await withChatAuth(),
  );

export const getPersistedDigitalTwinConfig = getCachedDigitalTwinConfig;

// --- SKILL Plaza API ---

/**
 * Fetch the full skill catalog from the external SKILL plaza.
 * Chat proxies this to OPENIM_DIGITAL_TWIN_SKILL_PLAZA_URL/api/get_all_skill
 */
export const listPlazaSkills = async () =>
  getChatAxios().post<PlazaSkillListResponse>(
    "/digital_twin/skills/plaza/list",
    {},
    await withChatAuth(),
  );

/**
 * Download a skill from the plaza and install it into Orange's digital twin
 * skills directory. Chat downloads the zip from the plaza, then uploads it
 * to Orange's admin upload API.
 */
export const installPlazaSkill = async (skillName: string) =>
  getChatAxios().post<PlazaInstallResponse>(
    "/digital_twin/skills/plaza/install",
    { skillName },
    await withChatAuth(),
  );

// --- Direct plaza access (bypasses chat proxy) ---

/**
 * Raw plaza skill item as returned by GET /api/get_all_skill.
 * The response is a map: { "skill-name": PlazaSkillItemRaw }.
 */
type PlazaSkillItemRaw = {
  name: string;
  author: string;
  description: string;
  downloads: number;
  skill_type: string;
  thumbs_up: number;
  url?: string;
};

type PlazaDirectListResponse = Record<string, PlazaSkillItemRaw>;

/**
 * Fetch the skill catalog directly from the plaza server.
 * Mirrors chat's ListPlazaSkills but calls the plaza URL directly.
 */
export const listPlazaSkillsDirect = async () => {
  const data: PlazaDirectListResponse = await getPlazaAxios().get(
    "/api/get_all_skill",
  );
  // Flatten map to array (same shape as the chat-proxied response)
  const skills: PlazaSkillItem[] = Object.entries(data).map(
    ([name, item]) => ({
      name,
      author: item.author,
      description: item.description,
      downloads: item.downloads,
      skill_type: item.skill_type,
      thumbs_ups: item.thumbs_up,
    }),
  );
  return { data: { skills } };
};

/**
 * Download a skill zip from the plaza and install it into Orange directly.
 * This replicates what chat's DownloadAndInstallPlazaSkill does client-side:
 *   1. POST {plazaUrl}/api/download_skill  → get zip bytes
 *   2. POST {orangeUrl}/api/v1/digital-twin/skills/install  → upload to Orange
 *
 * @param skillName  Normalized skill name
 * @param ownerUserID  Current user ID for Orange sandbox path
 */
export const installPlazaSkillDirect = async (
  skillName: string,
  ownerUserID: string,
): Promise<{ data: PlazaInstallResponse }> => {
  // Step 1: Download zip from plaza
  const zipBlob: Blob = await getPlazaAxios().post(
    "/api/download_skill",
    { skill_name: skillName },
    { responseType: "blob" },
  );

  // Step 2: Upload to Orange's digital-twin skill install endpoint
  const formData = new FormData();
  formData.append("ownerUserID", ownerUserID);
  formData.append("file", zipBlob, `${skillName}.zip`);

  const resp = await getOrangeAxios().post(
    "/api/v1/digital-twin/skills/install",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  // Orange returns { errCode, data }; normalize to our shape
  return {
    data: {
      userID: ownerUserID,
      skillName,
      installed: true,
      message: "skill installed successfully (direct)",
    },
  };
};

// ── 知识库 API（通过 chat 后端代理到 Arkon）──────────────────────

/** 获取当前用户有权限的知识空间列表 */
export const listWikiSpaces = async () =>
  getChatAxios().post<{ spaces: WikiSpace[]; total: number }>(
    "/digital_twin/kb/spaces",
    {},
    await withChatAuth(),
  );

/** 获取指定知识空间的 Wiki 索引（文档目录） */
export const getWikiIndex = async (spaceId: string) =>
  getChatAxios().post<WikiIndex>(
    "/digital_twin/kb/index",
    { spaceId },
    await withChatAuth(),
  );

/** 知识语义搜索 */
export const knowledgeSearch = async (params: {
  query: string;
  spaceIds?: string[];
  topK?: number;
}) =>
  getChatAxios().post<KnowledgeSearchResponse>(
    "/digital_twin/kb/search",
    params,
    await withChatAuth(),
  );
