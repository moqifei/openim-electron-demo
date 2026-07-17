import { v4 as uuidv4 } from "uuid";

import {
  getCachedDigitalTwinConfig,
  setCachedDigitalTwinConfig,
} from "@/utils/digitalTwinStorage";
import { getChatAxios } from "@/utils/request";
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
