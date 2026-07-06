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

export type DigitalTwinSkillSummary = {
  name: string;
  description?: string;
  skillPath?: string;
  updatedAt?: number;
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
  getChatAxios().post<DigitalTwinSkillGenerateResponse>(
    "/digital_twin/skills/generate",
    { skillName, description },
    await withChatAuth(),
  );

export const listDigitalTwinSkills = async () =>
  getChatAxios().post<DigitalTwinSkillListResponse>(
    "/digital_twin/skills/list",
    {},
    await withChatAuth(),
  );

export const deleteDigitalTwinSkill = async (skillName: string) =>
  getChatAxios().post<DigitalTwinSkillDeleteResponse>(
    "/digital_twin/skills/delete",
    { skillName },
    await withChatAuth(),
  );

export const getPersistedDigitalTwinConfig = getCachedDigitalTwinConfig;
