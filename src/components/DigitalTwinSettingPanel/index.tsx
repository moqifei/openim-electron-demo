import { FriendUserItem } from "@openim/wasm-client-sdk/lib/types/entity";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tabs,
} from "antd";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteDigitalTwinSkill,
  DigitalTwinConfig,
  DigitalTwinKnowledgeBaseConfig,
  DigitalTwinReplyListReviewStatus,
  DigitalTwinReplyRecord,
  DigitalTwinReplyReviewStatus,
  DigitalTwinReplySummary,
  DigitalTwinSkillGenerateAcceptResponse,
  DigitalTwinSkillGenerateResponse,
  DigitalTwinSkillDetailResponse,
  DigitalTwinSkillSummary,
  DigitalTwinTriggerMode,
  WikiSpace,
  generateDigitalTwinSkill,
  getDigitalTwinOverview,
  getDigitalTwinSkill,
  getDigitalTwinUnreadTimeoutSummary,
  getSkillGenerateTaskStatus,
  getPersistedDigitalTwinConfig,
  installPlazaSkill,
  installPlazaSkillDirect,
  listDigitalTwinReplies,
  listDigitalTwinSkills,
  listPlazaSkills,
  listPlazaSkillsDirect,
  listWikiSpaces,
  reviewDigitalTwinReply,
  SkillGenerateTask,
  updateDigitalTwinConfig,
  PlazaSkillItem,
} from "@/api/digitalTwin";
import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import { ADDepartmentMemberInfo, searchADMembers } from "@/api/organization";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { notifyDigitalTwinRepliesChanged } from "@/utils/digitalTwinEvents";
import { filterByFuzzyPinyin } from "@/utils/pinyin";
import { publicAsset } from "@/utils/publicAsset";
import { isPlazaDirectMode } from "@/utils/config";

const DEFAULT_REPLY_TEXT = "我现在不方便回复，数字分身已收到你的消息。";
const digitalTwinIcon = publicAsset("icons/shuzifenshen.png");
export type DigitalTwinPanelSection = "overview" | "settings" | "skills" | "knowledge" | "records";

type DigitalTwinSettingPanelProps = {
  activeSection?: DigitalTwinPanelSection;
};

type ContactSelectorUser = {
  userID: string;
  nickname: string;
  faceURL?: string;
  remark?: string;
  email?: string;
  phone?: string;
  source?: "friend" | "ad" | "business";
};

const normalizeConfig = (config?: DigitalTwinConfig): DigitalTwinConfig => ({
  enabled: Boolean(config?.enabled),
  replyText: config?.replyText ?? DEFAULT_REPLY_TEXT,
  prompt: config?.prompt ?? "",
  replyCooldownSeconds: config?.replyCooldownSeconds ?? 0,
  triggerMode: config?.triggerMode ?? "immediate",
  unreadTimeoutSeconds: config?.unreadTimeoutSeconds ?? 180,
  replySchedule: {
    enabled: Boolean(config?.replySchedule?.enabled),
    startMinute: normalizeMinute(config?.replySchedule?.startMinute ?? 18 * 60),
    endMinute: normalizeMinute(config?.replySchedule?.endMinute ?? 9 * 60),
    timezone: config?.replySchedule?.timezone ?? getLocalTimezone(),
  },
  allowedSenderUserIDs: normalizeUserIDList(config?.allowedSenderUserIDs ?? []),
  blockedSenderUserIDs: normalizeUserIDList(config?.blockedSenderUserIDs ?? []),
  knowledgeBase: config?.knowledgeBase ?? {
    enabled: false,
    spaceIds: [],
    answerStrategy: "knowledge_only",
  },
  version: config?.version,
  updatedAt: config?.updatedAt,
});

const getLocalTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

const normalizeMinute = (minute?: number | null) => {
  if (!minute || minute < 0) return 0;
  if (minute > 1439) return 1439;
  return Math.floor(minute);
};

const normalizeCooldownSeconds = (seconds?: number | null) => {
  if (!seconds || seconds < 0) return 0;
  if (seconds > 86400) return 86400;
  return Math.floor(seconds);
};

const normalizeUnreadTimeoutSeconds = (seconds?: number | null) => {
  if (!seconds) return 180;
  if (seconds < 30) return 30;
  if (seconds > 86400) return 86400;
  return Math.floor(seconds);
};

const minuteToTimeValue = (minute: number) => {
  const safeMinute = normalizeMinute(minute);
  const hours = Math.floor(safeMinute / 60);
  const minutes = safeMinute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const timeValueToMinute = (value: string) => {
  const [hours = "0", minutes = "0"] = value.split(":");
  return normalizeMinute(Number(hours) * 60 + Number(minutes));
};

const normalizeUserIDList = (value: string[] | string) => {
  const source = Array.isArray(value) ? value : value.split(/[\n,，\s]+/);
  const seen = new Set<string>();
  return source
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 100);
};

const userIDListToText = (userIDs?: string[]) =>
  normalizeUserIDList(userIDs ?? []).join("\n");

const getContactUserDisplayName = (user?: ContactSelectorUser) =>
  user?.remark || user?.nickname || user?.userID || "";

const mapFriendToContactUser = (friend: FriendUserItem): ContactSelectorUser => ({
  userID: friend.userID,
  nickname: friend.nickname || friend.userID,
  faceURL: friend.faceURL,
  remark: friend.remark,
  source: "friend",
});

const mapADMemberToContactUser = (
  member: ADDepartmentMemberInfo,
): ContactSelectorUser => {
  const userID = member.userID || member.username;
  const nickname = member.nickname || member.displayName || member.username || userID;
  const faceURL = (member.faceURL || member.avatar || "").trim();
  return {
    userID,
    nickname,
    faceURL: faceURL && faceURL !== "null" && faceURL !== "undefined" ? faceURL : "",
    email: member.email,
    phone: member.phone,
    source: "ad",
  };
};

const mapBusinessUserToContactUser = (user: BusinessUserInfo): ContactSelectorUser => ({
  userID: user.userID,
  nickname: user.nickname || user.userID,
  faceURL: user.faceURL,
  email: user.email,
  phone: user.phoneNumber,
  source: "business",
});

const formatReplyTime = (createdAt?: number) => {
  if (!createdAt) return "-";
  return new Date(createdAt).toLocaleString();
};

const truncateText = (text = "", maxLength = 44) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const normalizeSkillNameInput = (raw: string) => {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return normalized.slice(0, 64);
};

// 检测字符串中是否包含中文字符
const hasChinese = (text: string): boolean => /[\u4e00-\u9fff]/.test(text);

const buildCorrectionSkillDescription = (
  record: DigitalTwinReplyRecord,
  correction: string,
  contactName: string,
) => {
  const triggerText = record.messageContent || "（原始消息为空或不可见）";
  const oldReply = record.replyText || "（原回复为空）";
  return [
    "这是数字分身的一条回复纠正训练样本，请生成稳定可触发的分身回复技能。",
    "",
    "## 适用场景",
    `- 当联系人 ${contactName} 或其他用户表达与下面「用户原始消息」相似的意思时使用。`,
    "- 当用户意图、语气或上下文与该样本相近时，优先遵循「纠正要求」。",
    "",
    "## 用户原始消息",
    triggerText,
    "",
    "## 分身原回复",
    oldReply,
    "",
    "## 纠正要求",
    correction,
    "",
    "## 输出要求",
    "- 以后遇到相似场景时，避免重复「分身原回复」里的问题。",
    "- 直接给出更符合纠正要求的自然回复。",
    "- 回复要像本人，简洁、礼貌、不过度解释。",
  ].join("\n");
};

const isTrainedReviewNote = (note?: string) => note?.startsWith("已训练：") ?? false;

const extractCorrectionNote = (note?: string) => {
  if (!note) return "";
  if (!isTrainedReviewNote(note)) return note;
  const [, ...restLines] = note.split("\n");
  return restLines.join("\n").trim();
};

const cooldownPresets = [
  { label: "不限制", value: 0 },
  { label: "1 分钟", value: 60 },
  { label: "5 分钟", value: 300 },
  { label: "15 分钟", value: 900 },
];

const triggerModeOptions: Array<{
  label: string;
  value: DigitalTwinTriggerMode;
  description: string;
  disabled?: boolean;
}> = [
  {
    label: "立即回复",
    value: "immediate",
    description: "消息到达并通过策略判断后立即由分身回复。",
  },
  {
    label: "手动托管",
    value: "manual",
    description: "保留配置但不自动回复，适合临时暂停分身接管。",
  },
  {
    label: "未读超时",
    value: "unread_timeout",
    description: "消息到达后先等待一段时间，超时仍符合策略时再由分身回复。",
  },
];

const reviewStatusText = (status?: string) => {
  switch (status) {
    case "confirmed":
      return "已确认";
    case "needs_follow_up":
      return "需跟进";
    default:
      return "未确认";
  }
};

const replyReviewFilters: Array<{
  label: string;
  value: DigitalTwinReplyListReviewStatus;
  countKey: keyof DigitalTwinReplySummary;
}> = [
  { label: "全部", value: "", countKey: "total" },
  { label: "未确认", value: "unreviewed", countKey: "unreviewed" },
  { label: "已确认", value: "confirmed", countKey: "confirmed" },
];

const emptyReplySummary: DigitalTwinReplySummary = {
  total: 0,
  unreviewed: 0,
  needsFollowUp: 0,
  confirmed: 0,
};

const DigitalTwinSettingPanel: FC<DigitalTwinSettingPanelProps> = ({
  activeSection,
}) => {
  const selfInfo = useUserStore((state) => state.selfInfo);
  const selfUserID = selfInfo.userID;
  const friendList = useContactStore((state) => state.friendList);
  const getFriendListByReq = useContactStore((state) => state.getFriendListByReq);
  const [config, setConfig] = useState<DigitalTwinConfig>(() => normalizeConfig());
  const [draftReplyText, setDraftReplyText] = useState(DEFAULT_REPLY_TEXT);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftCooldownSeconds, setDraftCooldownSeconds] = useState(0);
  const [draftTriggerMode, setDraftTriggerMode] =
    useState<DigitalTwinTriggerMode>("immediate");
  const [draftUnreadTimeoutSeconds, setDraftUnreadTimeoutSeconds] = useState(180);
  const [draftScheduleEnabled, setDraftScheduleEnabled] = useState(false);
  const [draftScheduleStartMinute, setDraftScheduleStartMinute] = useState(18 * 60);
  const [draftScheduleEndMinute, setDraftScheduleEndMinute] = useState(9 * 60);
  const [draftAllowedSenderUserIDs, setDraftAllowedSenderUserIDs] = useState("");
  const [draftBlockedSenderUserIDs, setDraftBlockedSenderUserIDs] = useState("");
  const [contactSelectorOpen, setContactSelectorOpen] = useState(false);
  const [contactSelectorMode, setContactSelectorMode] = useState<"allowed" | "blocked">(
    "allowed",
  );
  const [contactSelectorSearch, setContactSelectorSearch] = useState("");
  const [contactSelectorDraftIDs, setContactSelectorDraftIDs] = useState<string[]>([]);
  const [contactSearchResults, setContactSearchResults] = useState<
    ContactSelectorUser[]
  >([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [selectedContactMap, setSelectedContactMap] = useState<
    Record<string, ContactSelectorUser>
  >({});
  const [businessContactMap, setBusinessContactMap] = useState<
    Record<string, ContactSelectorUser>
  >({});
  // ── 知识库状态 ──
  const [kbEnabled, setKbEnabled] = useState(false);
  const [kbSpaceIds, setKbSpaceIds] = useState<string[]>([]);
  const [kbAnswerStrategy, setKbAnswerStrategy] = useState<"auto_search" | "knowledge_only">("auto_search");
  // 相似度阈值 / 搜索条数：空字符串表示「不配置，使用服务端兜底配置」。
  // 用字符串存储以便区分「未填写」与「填写了 0」。
  const [kbSimilarityThreshold, setKbSimilarityThreshold] = useState<string>("");
  const [kbSearchLimit, setKbSearchLimit] = useState<string>("");
  const [kbChecking, setKbChecking] = useState(false);
  const [wikiSpaces, setWikiSpaces] = useState<WikiSpace[]>([]);
  const [loadingWikiSpaces, setLoadingWikiSpaces] = useState(false);
  const [replyRecords, setReplyRecords] = useState<DigitalTwinReplyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [reviewingOperationID, setReviewingOperationID] = useState("");
  const [trainingOperationID, setTrainingOperationID] = useState("");
  const [trainingTask, setTrainingTask] = useState<SkillGenerateTask | null>(null);
  const [replyReviewFilter, setReplyReviewFilter] =
    useState<DigitalTwinReplyListReviewStatus>("");
  const [draftReviewNotes, setDraftReviewNotes] = useState<Record<string, string>>({});
  const [draftCorrectionSkillNames, setDraftCorrectionSkillNames] = useState<
    Record<string, string>
  >({});
  const [replyNextCursor, setReplyNextCursor] = useState(0);
  const [replyHasMore, setReplyHasMore] = useState(false);
  const [replySummary, setReplySummary] =
    useState<DigitalTwinReplySummary>(emptyReplySummary);
  const [overviewLatestReplies, setOverviewLatestReplies] = useState<
    DigitalTwinReplyRecord[]
  >([]);
  const [draftReplySenderUserID, setDraftReplySenderUserID] = useState("");
  const [replySenderUserID, setReplySenderUserID] = useState("");
  const [pendingUnreadTimeoutCount, setPendingUnreadTimeoutCount] = useState(0);
  const [draftSkillName, setDraftSkillName] = useState("");
  const [draftSkillDescription, setDraftSkillDescription] = useState("");
  const [generatingSkill, setGeneratingSkill] = useState(false);
  const [lastGeneratedSkill, setLastGeneratedSkill] =
    useState<DigitalTwinSkillGenerateResponse>();
  const [skills, setSkills] = useState<DigitalTwinSkillSummary[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [deletingSkillName, setDeletingSkillName] = useState("");

  // --- SKILL Plaza (企业技能广场) ---
  const [plazaSkills, setPlazaSkills] = useState<PlazaSkillItem[]>([]);
  const [loadingPlaza, setLoadingPlaza] = useState(false);
  const [plazaError, setPlazaError] = useState<string | null>(null);
  const [plazaPage, setPlazaPage] = useState(1);
  const PLAZA_PAGE_SIZE = 5;
  const [installingSkillName, setInstallingSkillName] = useState("");

  // Skill tab: "mine" | "plaza"
  const [skillTab, setSkillTab] = useState<"mine" | "plaza">("mine");

  // 查看单个技能完整内容（按需拉取，避免列表返回过大 content）
  const [viewingSkill, setViewingSkill] =
    useState<DigitalTwinSkillDetailResponse | null>(null);
  const [loadingSkillDetail, setLoadingSkillDetail] = useState(false);

  const applyConfig = (nextConfig?: DigitalTwinConfig, syncDrafts = true) => {
    const normalized = normalizeConfig(nextConfig);
    setConfig(normalized);
    if (syncDrafts) {
      setDraftReplyText(normalized.replyText ?? DEFAULT_REPLY_TEXT);
      setDraftPrompt(normalized.prompt ?? "");
      setDraftCooldownSeconds(normalized.replyCooldownSeconds ?? 0);
      setDraftTriggerMode(normalized.triggerMode ?? "immediate");
      setDraftUnreadTimeoutSeconds(
        normalizeUnreadTimeoutSeconds(normalized.unreadTimeoutSeconds),
      );
      setDraftScheduleEnabled(Boolean(normalized.replySchedule?.enabled));
      setDraftScheduleStartMinute(normalized.replySchedule?.startMinute ?? 18 * 60);
      setDraftScheduleEndMinute(normalized.replySchedule?.endMinute ?? 9 * 60);
      setDraftAllowedSenderUserIDs(userIDListToText(normalized.allowedSenderUserIDs));
      setDraftBlockedSenderUserIDs(userIDListToText(normalized.blockedSenderUserIDs));
      // Sync knowledge base config
      const kb = normalized.knowledgeBase;
      setKbEnabled(kb?.enabled ?? false);
      setKbSpaceIds(kb?.spaceIds ?? []);
      // 策略迁移：仅 no_fabricate（已废弃选项）→ 映射为 knowledge_only（强制每次搜索）；auto_search 保留原值
      const rawStrategy: string = kb?.answerStrategy ?? "auto_search";
      if (rawStrategy === "no_fabricate") {
        setKbAnswerStrategy("knowledge_only");
      } else {
        setKbAnswerStrategy(rawStrategy as "auto_search" | "knowledge_only");
      }
      // 相似度阈值 / 搜索条数：用户未配置（undefined）则留空，交由服务端兜底。
      setKbSimilarityThreshold(
        kb?.similarityThreshold != null ? String(kb.similarityThreshold) : "",
      );
      setKbSearchLimit(
        kb?.searchLimit != null ? String(kb.searchLimit) : "",
      );
      // 开启状态下主动加载知识空间列表
      if (kb?.enabled && wikiSpaces.length === 0) void loadWikiSpaces();
    }
  };

  const friendMap = useMemo(() => {
    const map = new Map<string, FriendUserItem>();
    friendList.forEach((friend) => {
      if (friend.userID) {
        map.set(friend.userID, friend);
      }
    });
    return map;
  }, [friendList]);

  const localContactList = useMemo(
    () => friendList.filter((friend) => friend.userID).map(mapFriendToContactUser),
    [friendList],
  );

  const filteredLocalContactList = useMemo(() => {
    const keyword = contactSelectorSearch.trim().toLowerCase();
    if (!keyword) return localContactList;
    return localContactList.filter((contact) => {
      const fields = [
        contact.userID,
        contact.remark,
        contact.nickname,
        contact.email,
        contact.phone,
      ].filter((field): field is string => typeof field === "string");
      return fields.some((field) => field.toLowerCase().includes(keyword));
    });
  }, [contactSelectorSearch, localContactList]);

  const selectorVisibleContacts = useMemo(() => {
    const contacts = contactSelectorSearch.trim()
      ? [...contactSearchResults, ...filteredLocalContactList]
      : filteredLocalContactList;
    const seen = new Set<string>();
    return contacts.filter((contact) => {
      if (!contact.userID || seen.has(contact.userID)) return false;
      seen.add(contact.userID);
      return true;
    });
  }, [contactSearchResults, contactSelectorSearch, filteredLocalContactList]);

  const selectedAllowedSenderUserIDs = useMemo(
    () => normalizeUserIDList(draftAllowedSenderUserIDs),
    [draftAllowedSenderUserIDs],
  );
  const selectedBlockedSenderUserIDs = useMemo(
    () => normalizeUserIDList(draftBlockedSenderUserIDs),
    [draftBlockedSenderUserIDs],
  );

  const contactSelectorTitle =
    contactSelectorMode === "allowed" ? "选择只回复联系人" : "选择不要回复联系人";

  const getContactInfo = (userID: string) => {
    const friend = friendMap.get(userID);
    if (friend) return mapFriendToContactUser(friend);
    return selectedContactMap[userID] || businessContactMap[userID];
  };

  const getContactDisplayName = (userID: string) =>
    getContactUserDisplayName(getContactInfo(userID)) || userID;

  const openContactSelector = (mode: "allowed" | "blocked") => {
    setContactSelectorMode(mode);
    setContactSelectorSearch("");
    setContactSearchResults([]);
    setContactSelectorDraftIDs(
      mode === "allowed"
        ? normalizeUserIDList(draftAllowedSenderUserIDs)
        : normalizeUserIDList(draftBlockedSenderUserIDs),
    );
    setContactSelectorOpen(true);
  };

  const toggleContactSelectorUser = (userID: string, checked: boolean) => {
    setContactSelectorDraftIDs((prevIDs) => {
      const nextIDs = checked
        ? normalizeUserIDList([...prevIDs, userID])
        : prevIDs.filter((id) => id !== userID);
      return nextIDs;
    });
    const contact = selectorVisibleContacts.find((item) => item.userID === userID);
    if (checked && contact) {
      setSelectedContactMap((prevMap) => ({
        ...prevMap,
        [userID]: contact,
      }));
    }
  };

  const applyContactSelector = () => {
    const selectedIDs = normalizeUserIDList(contactSelectorDraftIDs);
    if (contactSelectorMode === "allowed") {
      setDraftAllowedSenderUserIDs(userIDListToText(selectedIDs));
      setDraftBlockedSenderUserIDs((prevIDs) =>
        userIDListToText(
          normalizeUserIDList(prevIDs).filter(
            (userID) => !selectedIDs.includes(userID),
          ),
        ),
      );
    } else {
      setDraftBlockedSenderUserIDs(userIDListToText(selectedIDs));
      setDraftAllowedSenderUserIDs((prevIDs) =>
        userIDListToText(
          normalizeUserIDList(prevIDs).filter(
            (userID) => !selectedIDs.includes(userID),
          ),
        ),
      );
    }
    setContactSelectorOpen(false);
  };

  const removeSelectedContact = (mode: "allowed" | "blocked", userID: string) => {
    if (mode === "allowed") {
      setDraftAllowedSenderUserIDs((prevIDs) =>
        userIDListToText(normalizeUserIDList(prevIDs).filter((id) => id !== userID)),
      );
      return;
    }
    setDraftBlockedSenderUserIDs((prevIDs) =>
      userIDListToText(normalizeUserIDList(prevIDs).filter((id) => id !== userID)),
    );
  };

  const buildReplySchedule = () => ({
    enabled: draftScheduleEnabled,
    startMinute: draftScheduleStartMinute,
    endMinute: draftScheduleEndMinute,
    timezone: getLocalTimezone(),
  });

  const buildSenderPolicy = () => ({
    allowedSenderUserIDs: normalizeUserIDList(draftAllowedSenderUserIDs),
    blockedSenderUserIDs: normalizeUserIDList(draftBlockedSenderUserIDs),
  });

  const applyReplyRecords = (
    records: DigitalTwinReplyRecord[] | null | undefined,
    append = false,
  ) => {
    const safeRecords = Array.isArray(records) ? records : [];
    setReplyRecords((prevRecords) =>
      append ? [...prevRecords, ...safeRecords] : safeRecords,
    );
    setDraftReviewNotes((prevNotes) => {
      const nextNotes = { ...prevNotes };
      safeRecords.forEach((record) => {
        if (record.operationID && nextNotes[record.operationID] === undefined) {
          nextNotes[record.operationID] = extractCorrectionNote(record.reviewNote);
        }
      });
      return nextNotes;
    });
    setDraftCorrectionSkillNames((prevNames) => {
      const nextNames = { ...prevNames };
      safeRecords.forEach((record) => {
        if (record.operationID && nextNames[record.operationID] === undefined) {
          nextNames[record.operationID] = "";
        }
      });
      return nextNames;
    });
  };

  const loadReplyRecords = useCallback(
    async (append = false, beforeCreatedAt = 0) => {
      if (!selfUserID) return;
      setLoadingReplies(true);
      try {
        const response = await listDigitalTwinReplies(
          10,
          replyReviewFilter,
          append ? beforeCreatedAt : 0,
          replySenderUserID,
        );
        applyReplyRecords(response.data.records, append);
        setReplyHasMore(Boolean(response.data.hasMore));
        setReplyNextCursor(response.data.nextCursor ?? 0);
        setReplySummary(response.data.summary ?? emptyReplySummary);
      } catch (error) {
        feedbackToast({ error, msg: "获取数字分身回复记录失败" });
      } finally {
        setLoadingReplies(false);
      }
    },
    [replyReviewFilter, replySenderUserID, selfUserID],
  );

  const loadUnreadTimeoutSummary = useCallback(async () => {
    if (!selfUserID) return;
    try {
      const response = await getDigitalTwinUnreadTimeoutSummary();
      setPendingUnreadTimeoutCount(response.data.summary?.pending ?? 0);
    } catch {
      setPendingUnreadTimeoutCount(0);
    }
  }, [selfUserID]);

  const loadOverview = useCallback(
    async (showError = false, syncDrafts = true) => {
      if (!selfUserID) return;
      try {
        const response = await getDigitalTwinOverview();
        applyConfig(response.data.config, syncDrafts);
        setReplySummary(response.data.replySummary ?? emptyReplySummary);
        setPendingUnreadTimeoutCount(response.data.unreadTimeoutSummary?.pending ?? 0);
        setOverviewLatestReplies(
          Array.isArray(response.data.latestReplies) ? response.data.latestReplies : [],
        );
      } catch (error) {
        if (showError) {
          feedbackToast({ error, msg: "获取数字分身概览失败" });
        } else {
          console.warn("load digital twin overview failed", error);
        }
      }
    },
    [selfUserID],
  );

  const loadSkills = useCallback(async () => {
    if (!selfUserID) return;
    setLoadingSkills(true);
    try {
      const response = await listDigitalTwinSkills();
      setSkills(Array.isArray(response.data.skills) ? response.data.skills : []);
    } catch (error) {
      feedbackToast({ error, msg: "获取分身技能失败" });
    } finally {
      setLoadingSkills(false);
    }
  }, [selfUserID]);

  const viewSkillContent = async (skillName: string) => {
    setLoadingSkillDetail(true);
    setViewingSkill(null);
    try {
      const response = await getDigitalTwinSkill(skillName);
      setViewingSkill(response.data);
    } catch (error) {
      feedbackToast({ error, msg: "获取技能内容失败" });
    } finally {
      setLoadingSkillDetail(false);
    }
  };

  // --- SKILL Plaza functions ---
  const loadPlazaSkills = useCallback(async () => {
    setLoadingPlaza(true);
    setPlazaError(null);
    try {
      const direct = isPlazaDirectMode();
      console.log(`[plaza] loading skills via ${direct ? "DIRECT" : "chat-proxy"} mode`);
      const response = direct
        ? await listPlazaSkillsDirect()
        : await listPlazaSkills();
      setPlazaSkills(
        Array.isArray(response.data.skills) ? response.data.skills : [],
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        "SKILL广场暂不可用";
      setPlazaError(msg);
      // Don't show toast for plaza — the inline error UI is enough
    } finally {
      setLoadingPlaza(false);
    }
  }, []);

  const installFromPlaza = useCallback(async (skillName: string) => {
    if (installingSkillName === skillName) return;
    console.log("[plaza-install] START installing skill:", skillName);
    setInstallingSkillName(skillName);
    try {
      const direct = isPlazaDirectMode();
      console.log(`[plaza-install] using ${direct ? "DIRECT" : "chat-proxy"} mode`);
      if (direct) {
        // Client-direct path: download from plaza → upload to Orange
        if (!selfUserID) throw new Error("user ID not available for direct install");
        const resp = await installPlazaSkillDirect(skillName, selfUserID);
        console.log("[plaza-install] direct API response received:", JSON.stringify(resp.data));
      } else {
        // Legacy path: chat service proxies both download + install
        console.log("[plaza-install] calling installPlazaSkill API (chat proxy)...");
        const resp = await installPlazaSkill(skillName);
        console.log("[plaza-install] API response received:", JSON.stringify(resp.data));
      }
      feedbackToast({ msg: `技能 ${skillName} 安装成功` });
      // Refresh local skills list to show newly installed skill
      void loadSkills();
    } catch (error: any) {
      console.error("[plaza-install] FAILED:", error);
      console.error("[plaza-install] error response:", error?.response?.data);
      feedbackToast({
        error,
        msg: error?.response?.data?.detail || `安装 ${skillName} 失败`,
      });
    } finally {
      setInstallingSkillName("");
    }
  }, [installingSkillName, loadSkills, selfUserID]);

  // Client-side pagination for plaza
  const paginatedPlazaSkills = useMemo(() => {
    const start = (plazaPage - 1) * PLAZA_PAGE_SIZE;
    return plazaSkills.slice(start, start + PLAZA_PAGE_SIZE);
  }, [plazaSkills, plazaPage]);
  const plazaTotalPages = Math.max(1, Math.ceil(plazaSkills.length / PLAZA_PAGE_SIZE));

  useEffect(() => {
    if (!selfUserID) return;

    let mounted = true;
    setLoading(true);

    const loadConfig = async () => {
      try {
        const cachedConfig = await getPersistedDigitalTwinConfig(selfUserID);
        if (mounted && cachedConfig) {
          applyConfig(cachedConfig);
        }

        if (mounted) {
          await loadOverview(true);
        }
      } catch (error: unknown) {
        feedbackToast({ error, msg: "获取数字分身配置失败" });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadConfig();
    void loadReplyRecords();
    void loadSkills();
    if (friendList.length === 0) {
      void getFriendListByReq();
    }
    // Pre-load wiki spaces if KB was previously enabled
    if (config?.knowledgeBase?.enabled) {
      void loadWikiSpaces();
    }
    const summaryTimer = window.setInterval(() => {
      void loadOverview(false, false);
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(summaryTimer);
    };
  }, [
    friendList.length,
    getFriendListByReq,
    loadOverview,
    loadReplyRecords,
    loadSkills,
    selfUserID,
  ]);

  const updateEnabled = async (checked: boolean) => {
    setSwitching(true);
    try {
      const response = await updateDigitalTwinConfig({
        enabled: checked,
        replyText: draftReplyText,
        prompt: draftPrompt,
        replyCooldownSeconds: draftCooldownSeconds,
        triggerMode: draftTriggerMode,
        unreadTimeoutSeconds: draftUnreadTimeoutSeconds,
        replySchedule: buildReplySchedule(),
        ...buildSenderPolicy(),
        knowledgeBase: buildKnowledgeBaseConfig(),
      });
      applyConfig(response.data.config);
      void loadReplyRecords();
      void loadUnreadTimeoutSummary();
      feedbackToast({ msg: checked ? "数字分身已开启" : "数字分身已关闭" });
    } catch (error) {
      feedbackToast({ error, msg: "更新数字分身开关失败" });
    } finally {
      setSwitching(false);
    }
  };

  /** 构建知识库配置对象 */
  const buildKnowledgeBaseConfig = (): DigitalTwinKnowledgeBaseConfig => {
    const cfg: DigitalTwinKnowledgeBaseConfig = {
      enabled: kbEnabled,
      spaceIds: kbSpaceIds,
      answerStrategy: kbAnswerStrategy,
    };
    // 仅当用户填写时才输出，未填写（空字符串）则不传，使用服务端兜底配置。
    const threshold = kbSimilarityThreshold.trim();
    if (threshold !== "") {
      const n = Number(threshold);
      if (!Number.isNaN(n)) cfg.similarityThreshold = n;
    }
    const limit = kbSearchLimit.trim();
    if (limit !== "") {
      const n = Number(limit);
      if (!Number.isNaN(n)) cfg.searchLimit = n;
    }
    return cfg;
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await updateDigitalTwinConfig({
        enabled: config.enabled,
        replyText: draftReplyText,
        prompt: draftPrompt,
        replyCooldownSeconds: draftCooldownSeconds,
        triggerMode: draftTriggerMode,
        unreadTimeoutSeconds: draftUnreadTimeoutSeconds,
        replySchedule: buildReplySchedule(),
        ...buildSenderPolicy(),
        knowledgeBase: buildKnowledgeBaseConfig(),
      });
      applyConfig(response.data.config);
      void loadReplyRecords();
      void loadUnreadTimeoutSummary();
      feedbackToast({ msg: "数字分身配置已保存" });
    } catch (error) {
      feedbackToast({ error, msg: "保存数字分身配置失败" });
    } finally {
      setSaving(false);
    }
  };

  /** 加载知识空间列表（用于知识库设置中的空间选择） */
  const loadWikiSpaces = useCallback(async () => {
    setLoadingWikiSpaces(true);
    try {
      const { data } = await listWikiSpaces();
      setWikiSpaces(data.spaces ?? []);
    } catch {
      // 静默失败，知识库功能可选
      setWikiSpaces([]);
    } finally {
      setLoadingWikiSpaces(false);
    }
  }, []);

  const reviewReply = async (
    operationID: string | undefined,
    status: DigitalTwinReplyReviewStatus,
  ) => {
    if (!operationID) return;
    setReviewingOperationID(operationID);
    try {
      await reviewDigitalTwinReply(
        operationID,
        status,
        draftReviewNotes[operationID] ?? "",
      );
      await loadReplyRecords();
      notifyDigitalTwinRepliesChanged();
      feedbackToast({
        msg: status === "confirmed" ? "已确认这条分身回复" : "已标记为需跟进",
      });
    } catch (error) {
      feedbackToast({ error, msg: "更新分身回复状态失败" });
    } finally {
      setReviewingOperationID("");
    }
  };

  const pollSkillGenerateTask = useCallback(
    async (taskId: string, record: DigitalTwinReplyRecord, skillName: string, correction: string) => {
      const POLL_INTERVAL_MS = 2000;
      const MAX_POLLS = 90; // ~3 minutes max

      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const taskRes = await getSkillGenerateTaskStatus(taskId);
          const task = taskRes.data;
          setTrainingTask(task);

          if (task.status === "completed") {
            const skillResp: DigitalTwinSkillGenerateResponse = {
              userID: task.owner_user_id,
              skillName: task.skill_name,
              skillPath: task.skill_path ?? "",
              source: task.source,
            };
            setLastGeneratedSkill(skillResp);
            await reviewDigitalTwinReply(
              record.operationID,
              "confirmed",
              `已训练：${task.skill_name}\n${correction}`,
            );
            await loadSkills();
            await loadReplyRecords();
            notifyDigitalTwinRepliesChanged();
            feedbackToast({ msg: "纠正已训练，后续相似场景会优先参考" });
            setTrainingTask(null);
            return;
          }

          if (task.status === "failed") {
            feedbackToast({
              msg: `纠正训练失败：${task.error ?? "未知错误"}`,
            });
            setTrainingTask(null);
            return;
          }

          // still pending or running — continue polling
        } catch (err) {
          // chat 返回 errCode!=0 时，拦截器会把 {errCode,errMsg} 对象直接 reject
          const ae = err as any;
          const pollErrCode = ae?.errCode;
          const pollErrMsg =
            ae?.errMsg ??
            ae?.message ??
            (ae?.response ? JSON.stringify(ae.response.data) : "未知错误");
          console.warn("[trainCorrection] poll transient error, will retry:", {
            errCode: pollErrCode,
            errMsg: pollErrMsg,
            httpStatus: ae?.response?.status,
            url: ae?.config?.url,
            code: ae?.code,
          });
          // orange 在任务刚创建时可能尚未将其注册进状态表，会短暂返回 404/errCode，
          // 这属于竞态，继续轮询即可消化；真正的失败由 task.status === "failed" 处理，
          // 超时由 MAX_POLLS 兜底。此处不提前 return，避免抢跑 404 误判为终态失败。
          // 其余（网络抖动等）同样继续轮询。
        }
      }

      // timeout
      feedbackToast({ msg: "纠正训练超时，请稍后查看技能列表确认结果" });
      setTrainingTask(null);
    },
    [loadSkills, loadReplyRecords],
  );

  const trainCorrection = async (record: DigitalTwinReplyRecord) => {
    if (!record.operationID) return;
    if (record.reviewStatus === "confirmed") {
      feedbackToast({ msg: "已确认的记录不再支持纠正训练" });
      return;
    }
    const correction = (draftReviewNotes[record.operationID] ?? "").trim();
    if (!correction) {
      feedbackToast({ msg: "请先写下你希望分身以后怎么回复" });
      return;
    }

    // 检测原始输入是否包含中文
    const rawSkillName = draftCorrectionSkillNames[record.operationID] || "";
    if (hasChinese(rawSkillName)) {
      feedbackToast({ msg: "技能名称请使用英文输入，不要包含中文" });
      return;
    }

    const skillName = normalizeSkillNameInput(rawSkillName);
    if (!skillName) {
      feedbackToast({ msg: "请选择已有技能，或填写英文技能名称，例如 reply-greeting" });
      return;
    }
    if (skillName !== rawSkillName) {
      setDraftCorrectionSkillNames((prevNames) => ({
        ...prevNames,
        [record.operationID as string]: skillName,
      }));
    }
    const description = buildCorrectionSkillDescription(
      record,
      correction,
      getContactDisplayName(record.senderUserID),
    );
    setTrainingOperationID(record.operationID);
    try {
      const response = await generateDigitalTwinSkill(skillName, description);
      // Async accepted — start polling for completion.
      const taskId = response.data.task_id;
      if (!taskId) {
        console.error("[trainCorrection] submit returned no task_id:", response);
        feedbackToast({ msg: "训练提交失败：未收到任务ID" });
        return;
      }
      feedbackToast({ msg: "训练已提交，正在生成技能..." });
      await pollSkillGenerateTask(taskId, record, skillName, correction);
    } catch (error) {
      feedbackToast({ error, msg: "纠正训练失败" });
    } finally {
      setTrainingOperationID("");
    }
  };

  const generateSkill = async () => {
    const skillName = draftSkillName.trim();
    const description = draftSkillDescription.trim();
    if (!skillName || !description) {
      feedbackToast({ msg: "请填写技能名称和技能需求" });
      return;
    }
    if (hasChinese(skillName)) {
      feedbackToast({ msg: "技能名称请使用英文输入，不要包含中文" });
      return;
    }
    setGeneratingSkill(true);
    try {
      const response = await generateDigitalTwinSkill(skillName, description);
      // Async accepted — start polling for completion.
      const taskId = response.data.task_id;
      if (!taskId) {
        console.error("[generateSkill] submit returned no task_id:", response);
        feedbackToast({ msg: "技能生成提交失败：未收到任务ID" });
        return;
      }
      feedbackToast({ msg: "技能生成已提交，正在处理..." });

      // Poll for completion.
      const POLL_INTERVAL_MS = 2000;
      const MAX_POLLS = 90; // ~3 minutes max
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const taskRes = await getSkillGenerateTaskStatus(taskId);
          const task = taskRes.data;
          setTrainingTask(task);

          if (task.status === "completed") {
            const skillResp: DigitalTwinSkillGenerateResponse = {
              userID: task.owner_user_id,
              skillName: task.skill_name,
              skillPath: task.skill_path ?? "",
              source: task.source,
            };
            setLastGeneratedSkill(skillResp);
            setDraftSkillDescription("");
            await loadSkills();
            feedbackToast({ msg: `技能 ${task.skill_name} 已生成` });
            setTrainingTask(null);
            return;
          }

          if (task.status === "failed") {
            feedbackToast({
              msg: `生成失败：${task.error ?? "未知错误"}`,
            });
            setTrainingTask(null);
            return;
          }
        } catch (err) {
          // chat 返回 errCode!=0 时，拦截器会把 {errCode,errMsg} 对象直接 reject
          const ae = err as any;
          const pollErrCode = ae?.errCode;
          const pollErrMsg =
            ae?.errMsg ??
            ae?.message ??
            (ae?.response ? JSON.stringify(ae.response.data) : "未知错误");
          console.warn("[generateSkill] poll error:", {
            errCode: pollErrCode,
            errMsg: pollErrMsg,
            httpStatus: ae?.response?.status,
            url: ae?.config?.url,
            code: ae?.code,
          });
          // 业务错误(errCode 非空)或 404 → 明确失败，停止轮询，避免一直 loading
          if (pollErrCode !== undefined || ae?.response?.status === 404) {
            feedbackToast({ msg: `技能生成查询失败：${pollErrMsg}` });
            setTrainingTask(null);
            return;
          }
          // 其余视为瞬时网络错误，继续轮询
        }
      }

      // timeout
      feedbackToast({ msg: "生成超时，请稍后查看技能列表确认结果" });
      setTrainingTask(null);
    } catch (error) {
      feedbackToast({ error, msg: "生成分身技能失败" });
    } finally {
      setGeneratingSkill(false);
    }
  };

  const deleteSkill = async (skillName: string) => {
    setDeletingSkillName(skillName);
    try {
      const response = await deleteDigitalTwinSkill(skillName);
      await loadSkills();
      feedbackToast({
        msg: response.data.deleted
          ? `技能 ${skillName} 已删除`
          : `技能 ${skillName} 不存在`,
      });
    } catch (error) {
      feedbackToast({ error, msg: "删除分身技能失败" });
    } finally {
      setDeletingSkillName("");
    }
  };

  const showAllSections = !activeSection;
  const showOverview = showAllSections || activeSection === "overview";
  const showSettings = showAllSections || activeSection === "settings";
  const showSkills = showAllSections || activeSection === "skills";
  const showKnowledge = showAllSections || activeSection === "knowledge";
  const showRecords = showAllSections || activeSection === "records";

  const knownContactUserIDs = useMemo(() => {
    const ids = [
      ...selectedAllowedSenderUserIDs,
      ...selectedBlockedSenderUserIDs,
      ...replyRecords.map((record) => record.senderUserID),
      ...overviewLatestReplies.map((record) => record.senderUserID),
    ];
    return normalizeUserIDList(ids.filter(Boolean));
  }, [
    overviewLatestReplies,
    replyRecords,
    selectedAllowedSenderUserIDs,
    selectedBlockedSenderUserIDs,
  ]);

  useEffect(() => {
    if (!contactSelectorOpen) return;
    const keyword = contactSelectorSearch.trim();
    if (!keyword) {
      setContactSearchResults([]);
      setContactSearching(false);
      return;
    }

    setContactSearching(true);
    const timer = window.setTimeout(() => {
      searchADMembers({
        keyword,
        pagination: { pageNumber: 1, showNumber: 200 },
      })
        .then(async (response) => {
          let members = response.data.members ?? [];
          if (members.length === 0 && /^[a-zA-Z0-9]+$/.test(keyword)) {
            const fallbackResponse = await searchADMembers({
              keyword: "",
              pagination: { pageNumber: 1, showNumber: 200 },
            });
            members = fallbackResponse.data.members ?? [];
          }
          const mappedUsers = members
            .map(mapADMemberToContactUser)
            .filter((contact) => contact.userID);
          const users = filterByFuzzyPinyin(mappedUsers, keyword);
          setContactSearchResults(users);
          setSelectedContactMap((prevMap) => {
            const nextMap = { ...prevMap };
            users.forEach((user) => {
              nextMap[user.userID] = user;
            });
            return nextMap;
          });
        })
        .catch((error) => {
          console.warn("search digital twin contacts failed", error);
          setContactSearchResults([]);
        })
        .finally(() => setContactSearching(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [contactSelectorOpen, contactSelectorSearch]);

  useEffect(() => {
    const unknownUserIDs = knownContactUserIDs.filter(
      (userID) =>
        !friendMap.has(userID) &&
        !selectedContactMap[userID] &&
        !businessContactMap[userID],
    );
    if (unknownUserIDs.length === 0) return;

    let canceled = false;
    getBusinessUserInfo(unknownUserIDs.slice(0, 100))
      .then((response) => {
        if (canceled) return;
        const users = response.data.users ?? [];
        setBusinessContactMap((prevMap) => {
          const nextMap = { ...prevMap };
          users.forEach((user) => {
            if (user.userID) {
              nextMap[user.userID] = mapBusinessUserToContactUser(user);
            }
          });
          return nextMap;
        });
      })
      .catch((error) => {
        console.warn("load digital twin contact names failed", error);
      });

    return () => {
      canceled = true;
    };
  }, [businessContactMap, friendMap, knownContactUserIDs, selectedContactMap]);

  const renderCorrectionTrainingPanel = (record: DigitalTwinReplyRecord) => {
    if (!record.operationID) return null;

    if (record.reviewStatus === "confirmed" && isTrainedReviewNote(record.reviewNote)) {
      return (
        <div className="mt-3 rounded-lg border border-[#d1fadf] bg-[#f6fef9] px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[#027a48]">
              已通过纠正训练沉淀到技能
            </div>
            <span className="shrink-0 rounded-full bg-[#e7f8ef] px-2 py-0.5 text-xs font-medium text-[#039855]">
              已训练
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-[#667085]">
            {extractCorrectionNote(record.reviewNote)}
          </div>
        </div>
      );
    }

    if (record.reviewStatus === "confirmed") return null;

    const correctionText =
      draftReviewNotes[record.operationID] ?? extractCorrectionNote(record.reviewNote);

    return (
      <div className="mt-3 rounded-lg border border-[#d8ebff] bg-gradient-to-br from-[#f7fbff] to-white px-3 py-3">
        <div className="mb-3">
          <div className="text-sm font-semibold text-[#111827]">回复纠正训练</div>
          <div className="mt-1 text-xs leading-5 text-[#667085]">
            选择已有技能进行更新，或填写新的英文技能名；再写下你希望分身以后怎么回。
          </div>
        </div>

        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <div>
            <div className="mb-1 text-xs font-medium text-[#667085]">复用已有技能</div>
            <Select
              className="w-full"
              allowClear
              showSearch
              size="middle"
              placeholder="选择已有技能更新"
              value={undefined}
              optionFilterProp="label"
              options={skills.map((skill) => ({
                label: skill.name,
                value: skill.name,
              }))}
              onChange={(value) => {
                if (!value) return;
                setDraftCorrectionSkillNames((prevNames) => ({
                  ...prevNames,
                  [record.operationID as string]: value,
                }));
              }}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[#667085]">技能名称</div>
            <Input
              value={draftCorrectionSkillNames[record.operationID] ?? ""}
              maxLength={64}
              placeholder="必填，例如 reply-greeting"
              onChange={(event) =>
                setDraftCorrectionSkillNames((prevNames) => ({
                  ...prevNames,
                  [record.operationID as string]: normalizeSkillNameInput(
                    event.target.value,
                  ),
                }))
              }
            />
          </div>
        </div>

        <Input.TextArea
          value={correctionText}
          rows={4}
          maxLength={1600}
          placeholder="例如：以后遇到这类问题，先简短确认对方意图，再给出具体建议；不要只回复「收到」。"
          onChange={(event) =>
            setDraftReviewNotes((prevNotes) => ({
              ...prevNotes,
              [record.operationID as string]: event.target.value,
            }))
          }
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-[#98a2b3]">
            {trainingTask && trainingOperationID === record.operationID
              ? trainingTask.status === "pending"
                ? "训练任务已提交，等待处理..."
                : trainingTask.status === "running"
                  ? "模型正在生成技能内容，请稍候..."
                  : `训练${trainingTask.status === "completed" ? "完成" : "失败"}`
              : `已输入 ${correctionText.length}/1600，训练后下一轮 Orange 调用会加载该技能。`}
          </div>
          <Button
            size="small"
            type="primary"
            className="shrink-0"
            loading={trainingOperationID === record.operationID}
            disabled={reviewingOperationID === record.operationID}
            onClick={() => {
              void trainCorrection(record);
            }}
          >
            {trainingTask?.status === "running" ? "生成中..." : "纠正并训练"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full p-5 text-[var(--text-primary)]">
      {showOverview && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] shadow-sm">
          {/* 总览头部：渐变紫 + 核心信息 */}
          <div className="bg-gradient-to-br from-[#ede9fe] via-[#f5f3ff] to-white px-6 py-5 dark:from-[#1e1b4b] dark:to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] shadow-lg shadow-purple-200 dark:shadow-purple-900/30 ring-4 ring-white dark:ring-[#1f1235]">
                  <img
                    className="h-8 w-8 object-contain brightness-0 invert"
                    src={digitalTwinIcon}
                    alt=""
                  />
                  {/* 在线指示点 */}
                  {config.enabled && (
                    <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1f1235]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                      我的数字分身
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        config.enabled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {config.enabled ? "已开启" : "未开启"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                    当前用户：{selfInfo.nickname || selfUserID}
                  </div>
                </div>
              </div>
              <Switch
                checked={config.enabled}
                loading={loading || switching}
                onChange={(checked) => {
                  void updateEnabled(checked);
                }}
              />
            </div>

            {/* 统计卡片 */}
            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                { value: skills.length, label: "已安装技能", icon: "✨", color: "from-violet-500 to-purple-600" },
                { value: pendingUnreadTimeoutCount, label: "待接管消息", icon: "📥", color: "from-blue-500 to-cyan-500" },
                { value: replySummary.unreviewed ?? 0, label: "待确认代回", icon: "👀", color: "from-amber-500 to-orange-500" },
                { value: replySummary.total ?? 0, label: "累计代回", icon: "💬", color: "from-emerald-500 to-teal-500" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-xl bg-white/70 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className={`absolute -right-3 -top-3 text-3xl opacity-[0.06] group-hover:opacity-10 transition-opacity`}>
                    {stat.icon}
                  </div>
                  <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[var(--text-tertiary)]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 提示条 */}
          <div className="border-t border-[var(--border-color)] px-6 py-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            开启后，数字分身会按策略代为回复单聊消息；你可以确认正确回复，也可以把不合适的回复纠正成训练技能。
          </div>
        </div>
      )}

      {showOverview && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <span>📋</span>
                最近代回与纠错训练
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                快速查看最近 3 条分身代回；确认合适回复，或将不合适回复沉淀为训练技能。
              </div>
            </div>
            <Button
              size="small"
              loading={loadingReplies}
              onClick={() => {
                void loadOverview(true);
                void loadReplyRecords();
              }}
            >
              刷新
            </Button>
          </div>
          {overviewLatestReplies.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无代回动态" />
          ) : (
            <div className="space-y-2.5">
              {overviewLatestReplies.map((record) => (
                <div
                  className="group rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] px-4 py-3 transition-all hover:shadow-md hover:border-[#c4b5fd]"
                  key={`${record.operationID}-${record.createdAt}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[var(--text-quaternary)]">
                    <span className="inline-flex items-center gap-1.5 truncate font-medium text-[var(--text-tertiary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {getContactDisplayName(record.senderUserID)}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatReplyTime(record.createdAt)}</span>
                  </div>
                  {record.messageContent && (
                    <div className="mb-1 truncate rounded-lg bg-[var(--bg-body)] px-2.5 py-1.5 text-xs text-[var(--text-tertiary)]">
                      收到：{truncateText(record.messageContent)}
                    </div>
                  )}
                  <div className="line-clamp-2 text-sm leading-relaxed text-[var(--text-primary)]">
                    {record.replyText}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-quaternary)]">
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                      record.reviewStatus === "confirmed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {reviewStatusText(record.reviewStatus)}
                    </span>
                  </div>
                  {renderCorrectionTrainingPanel(record)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <>
          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <span>⚡</span>
                自动接管策略
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                设置分身什么时候接管，以及接管前需要等待多久。
              </div>
            </div>
            <div className="space-y-2">
              {triggerModeOptions.map((option) => (
                <button
                  className={`group w-full rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    draftTriggerMode === option.value
                      ? "border-[#c4b5fd] bg-[#f5f3ff] shadow-sm shadow-purple-100/50 dark:border-[#5b21b6] dark:bg-[#1e1b4b]"
                      : "border-[var(--border-color)] hover:border-[#d8b4fe] hover:shadow-sm"
                  } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  disabled={option.disabled || loading || saving}
                  key={option.value}
                  type="button"
                  onClick={() => setDraftTriggerMode(option.value)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      draftTriggerMode === option.value
                        ? "bg-[#7c3aed] text-white"
                        : "border-2 border-[var(--border-color)] text-transparent group-hover:border-[#a78bfa] group-hover:text-[#a78bfa]"
                    }`}>
                      {draftTriggerMode === option.value ? "✓" : ""}
                    </span>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</div>
                    {draftTriggerMode === option.value && (
                      <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-medium text-[#7c3aed]">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 pl-7 text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <InputNumber
                min={30}
                max={86400}
                precision={0}
                value={draftUnreadTimeoutSeconds}
                disabled={draftTriggerMode !== "unread_timeout" || loading || saving}
                onChange={(value) =>
                  setDraftUnreadTimeoutSeconds(normalizeUnreadTimeoutSeconds(value))
                }
              />
              <span className="text-xs text-[var(--text-tertiary)]">
                秒后触发；触发前会再次检查开关、时间段、联系人范围和冷却。
              </span>
            </div>
            {draftTriggerMode === "unread_timeout" && (
              <div className="mt-2 rounded-xl bg-gradient-to-r from-[#fef3c7]/80 to-[#fde68a]/30 px-3 py-2 text-xs font-medium text-amber-700 dark:from-amber-900/20 dark:text-amber-400">
                当前有 {pendingUnreadTimeoutCount} 条消息等待分身超时接管。
              </div>
            )}
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <span>✍️</span>
                回复风格
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                让分身知道默认怎么说，以及 Orange 不可用时如何兜底。
              </div>
            </div>
            <div className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">兜底回复</div>
            <Input.TextArea
              value={draftReplyText}
              rows={4}
              maxLength={300}
              showCount
              disabled={loading || saving}
              placeholder="当 Orange 暂时不可用时使用这段回复"
              onChange={(event) => setDraftReplyText(event.target.value)}
            />

            <div className="mb-1 mt-4 text-xs font-medium text-[var(--text-tertiary)]">
              分身提示词
            </div>
            <Input.TextArea
              value={draftPrompt}
              rows={4}
              maxLength={500}
              showCount
              disabled={loading || saving}
              placeholder="例如：简短、礼貌，像我本人一样回复"
              onChange={(event) => setDraftPrompt(event.target.value)}
            />
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <span>⏱️</span>
              同一联系人回复间隔
            </div>
            <div className="mb-3 text-xs text-[var(--text-tertiary)]">
              控制分身代回频率，避免连续消息被过度接管。
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {cooldownPresets.map((preset) => (
                <Button
                  key={preset.value}
                  size="small"
                  type={draftCooldownSeconds === preset.value ? "primary" : "default"}
                  onClick={() => setDraftCooldownSeconds(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <InputNumber
                min={0}
                max={86400}
                precision={0}
                value={draftCooldownSeconds}
                disabled={loading || saving}
                onChange={(value) =>
                  setDraftCooldownSeconds(normalizeCooldownSeconds(value))
                }
              />
              <span className="text-xs text-[var(--text-tertiary)]">
                秒内只回复一次，0 表示每条消息都可触发分身。
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <span>🕐</span>
                  自动托管时间段
                </div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  关闭时全天可自动回复；开启后只在指定时间段内由分身接管。
                </div>
              </div>
              <Switch
                size="small"
                checked={draftScheduleEnabled}
                disabled={loading || saving}
                onChange={setDraftScheduleEnabled}
              />
            </div>
            {draftScheduleEnabled && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input
                  className="w-[120px]"
                  type="time"
                  value={minuteToTimeValue(draftScheduleStartMinute)}
                  disabled={loading || saving}
                  onChange={(event) =>
                    setDraftScheduleStartMinute(timeValueToMinute(event.target.value))
                  }
                />
                <span className="text-xs text-[var(--text-tertiary)]">到</span>
                <Input
                  className="w-[120px]"
                  type="time"
                  value={minuteToTimeValue(draftScheduleEndMinute)}
                  disabled={loading || saving}
                  onChange={(event) =>
                    setDraftScheduleEndMinute(timeValueToMinute(event.target.value))
                  }
                />
                <span className="text-xs text-[var(--text-tertiary)]">
                  支持跨午夜，当前时区 {getLocalTimezone()}。
                </span>
              </div>
            )}
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <span>👥</span>
              联系人范围
            </div>
            <div className="mb-3 text-xs text-[var(--text-tertiary)]">
              默认所有联系人都可触发分身；设置"只回复"后只对列表内联系人生效。不要回复名单优先。
            </div>
            <div className="mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] p-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">
                    只回复这些联系人
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-quaternary)]">
                    留空表示所有联系人都可触发分身。
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {selectedAllowedSenderUserIDs.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => setDraftAllowedSenderUserIDs("")}
                    >
                      清空
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="primary"
                    disabled={loading || saving}
                    onClick={() => openContactSelector("allowed")}
                  >
                    选择联系人
                  </Button>
                </div>
              </div>
              {selectedAllowedSenderUserIDs.length === 0 ? (
                <div className="rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-xs text-[var(--text-quaternary)]">
                  暂未限制联系人范围
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAllowedSenderUserIDs.map((userID) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-2.5 py-1 text-xs font-medium text-[#7c3aed] dark:bg-[#1e1b4b]"
                      key={userID}
                    >
                      {getContactDisplayName(userID)}
                      <button
                        className="ml-0.5 text-[#a78bfa] hover:text-[#7c3aed]"
                        type="button"
                        onClick={() => removeSelectedContact("allowed", userID)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] p-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-secondary)]">
                    不要回复这些联系人
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-quaternary)]">
                    命中后分身不会自动回复，优先级高于只回复名单。
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {selectedBlockedSenderUserIDs.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => setDraftBlockedSenderUserIDs("")}
                    >
                      清空
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="primary"
                    disabled={loading || saving}
                    onClick={() => openContactSelector("blocked")}
                  >
                    选择联系人
                  </Button>
                </div>
              </div>
              {selectedBlockedSenderUserIDs.length === 0 ? (
                <div className="rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-xs text-[var(--text-quaternary)]">
                  暂未排除联系人
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedBlockedSenderUserIDs.map((userID) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-red-50 px-2.5 py-1 text-xs font-medium text-[#991b1b] dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"
                      key={userID}
                    >
                      {getContactDisplayName(userID)}
                      <button
                        className="ml-0.5 text-red-400 hover:text-red-600"
                        type="button"
                        onClick={() => removeSelectedContact("blocked", userID)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-base)]/95 px-5 py-3 backdrop-blur">
            <div className="text-xs text-[var(--text-quaternary)]">
              {config.updatedAt
                ? `上次保存：${new Date(config.updatedAt).toLocaleString()}`
                : "尚未保存"}
            </div>
            <Button
              type="primary"
              loading={saving}
              disabled={loading}
              onClick={() => {
                void saveConfig();
              }}
            >
              保存配置
            </Button>
          </div>
        </>
      )}

      {showSkills && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] shadow-sm overflow-hidden">
          {/* ===== Tab 页签：我的技能 / 技能广场 ===== */}
          <Tabs
            activeKey={skillTab}
            onChange={(key) => {
              setSkillTab(key as "mine" | "plaza");
              if (key === "plaza" && plazaSkills.length === 0 && !loadingPlaza) {
                void loadPlazaSkills();
              }
            }}
            size="middle"
            className="[&_.ant-tabs-nav]:px-5 [&_.ant-tabs-nav]:pt-4 [&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-tab]:text-sm"
            items={[
              {
                key: "mine",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span>✨</span> 我的技能
                    {skills.length > 0 && (
                      <span className="rounded-full bg-[#ede9fe] px-1.5 py-px text-[10px] font-bold text-[#7c3aed]">
                        {skills.length}
                      </span>
                    )}
                  </span>
                ),
                children: (
                  <div className="p-5 pt-3 space-y-4">
                    {/* 技能生成区 */}
                    <div className="rounded-xl border border-dashed border-[#c4b5fd] bg-gradient-to-br from-[#faf5ff] to-white p-4 dark:from-[#1e1b4b] dark:to-transparent">
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#7c3aed]">
                        <span>🧪</span>
                        生成新技能
                      </div>
                      <div className="mb-2">
                        <div className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">技能目录名</div>
                        <Input
                          value={draftSkillName}
                          maxLength={64}
                          disabled={loading || generatingSkill}
                          placeholder="例如：pome"
                          onChange={(event) => setDraftSkillName(event.target.value)}
                        />
                      </div>
                      <div className="mb-4">
                        <div className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">技能需求</div>
                        <Input.TextArea
                          value={draftSkillDescription}
                          rows={3}
                          maxLength={1600}
                          showCount
                          disabled={loading || generatingSkill}
                          placeholder="例如：用户让我作诗时，返回静夜思、李白的诗句"
                          onChange={(event) => setDraftSkillDescription(event.target.value)}
                        />
                      </div>

                      <div className="-mt-1 mb-2 min-w-0 text-[11px] leading-relaxed text-[var(--text-quaternary)]">
                        {trainingTask && generatingSkill ? (
                          trainingTask.status === "pending"
                            ? "任务已提交，等待处理..."
                            : trainingTask.status === "running"
                              ? "模型正在生成技能内容，请稍候..."
                              : trainingTask.status === "completed"
                                ? "技能已生成完成"
                                : `生成失败：${trainingTask.error ?? "未知错误"}`
                        ) : lastGeneratedSkill ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <span>✅</span>
                            已安装：<code className="font-mono text-xs font-semibold">{lastGeneratedSkill.skillName}</code>
                            <span className="text-emerald-400">·</span>
                            {lastGeneratedSkill.source}
                          </span>
                        ) : (
                          "生成后立即写入分身工作区，下一轮 Orange 调用可读取。"
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={loading || generatingSkill}
                        onClick={() => {
                          void generateSkill();
                        }}
                        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-300 active:translate-y-0 active:shadow-sm disabled:pointer-events-none disabled:opacity-50 dark:shadow-purple-900/30 dark:hover:shadow-purple-800/40"
                      >
                        {generatingSkill ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                            </svg>
                            {trainingTask?.status === "running" ? "生成中…" : trainingTask?.status === "pending" ? "已提交…" : "生成中…"}
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 transition-transform group-hover:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                            </svg>
                            生成技能
                          </span>
                        )}
                      </button>
                    </div>

                    {/* 已安装技能列表 */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                          <span>📦</span>
                          已安装
                          {skills.length > 0 && (
                            <span className="rounded-full bg-[#ede9fe] px-1.5 py-px text-[10px] font-bold text-[#7c3aed]">
                              {skills.length}
                            </span>
                          )}
                        </div>
                        <Button
                          size="small"
                          loading={loadingSkills}
                          onClick={() => {
                            void loadSkills();
                          }}
                        >
                          刷新
                        </Button>
                      </div>
                      {skills.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="暂无自定义技能，试试生成一个或从广场安装"
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                          {skills.map((skill) => (
                            <div
                              className="group rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] p-3.5 transition-all hover:shadow-md hover:border-[#d8b4fe]"
                              key={skill.name}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <code className="rounded-md bg-[#f5f3ff] px-2 py-0.5 font-mono text-sm font-bold text-[#7c3aed] dark:bg-[#1e1b4b]">
                                      {skill.name}
                                    </code>
                                  </div>
                                  <div className="mt-1.5 max-h-[120px] overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-[var(--text-tertiary)]">
                                    {skill.content || skill.description ||
                                      "暂无描述，建议重新生成以提升触发稳定性。"}
                                  </div>
                                  {skill.updatedAt && (
                                    <div className="mt-1.5 text-xs text-[var(--text-quaternary)]">
                                      更新：{new Date(skill.updatedAt).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      void viewSkillContent(skill.name);
                                    }}
                                  >
                                    查看内容
                                  </Button>
                                  <Popconfirm
                                    title={`删除技能 ${skill.name}？`}
                                    description="删除后下一轮分身回复将不再加载该技能。"
                                    okText="删除"
                                    cancelText="取消"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => {
                                      void deleteSkill(skill.name);
                                    }}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      loading={deletingSkillName === skill.name}
                                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      删除
                                    </Button>
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "plaza",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span>🏪</span> 技能广场
                    {plazaSkills.length > 0 && (
                      <span className="rounded-full bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-bold text-[#d97706]">
                        {plazaSkills.length}
                      </span>
                    )}
                  </span>
                ),
                children: (
                  <div className="p-5 pt-3">
                    <div className="mb-3 flex items-center justify-end">
                      <Button
                        size="small"
                        loading={loadingPlaza}
                        onClick={() => {
                          setPlazaPage(1);
                          void loadPlazaSkills();
                        }}
                      >
                        刷新
                      </Button>
                    </div>

                    {plazaError ? (
                      <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 text-center">
                        <div className="text-sm text-[var(--text-tertiary)]">{plazaError}</div>
                        <div className="mt-2 text-xs text-[var(--text-quaternary)]">
                          不影响本地技能的生成、查看和删除
                        </div>
                      </div>
                    ) : loadingPlaza && plazaSkills.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <Spin />
                      </div>
                    ) : plazaSkills.length === 0 && !loadingPlaza ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span className="text-xs">
                            暂无广场技能
                            <button
                              type="button"
                              className="ml-2 text-[#7c3aed] underline"
                              onClick={() => void loadPlazaSkills()}
                            >
                              点击加载
                            </button>
                          </span>
                        }
                      />
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                          {paginatedPlazaSkills.map((skill) => {
                            const isInstalled = skills.some((s) => s.name === skill.name);
                            return (
                              <div
                                className={`group rounded-xl border p-3.5 transition-all hover:shadow-md ${
                                  isInstalled
                                    ? "border-[#d1fae5] bg-[#ecfdf5]/50 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                                    : "border-[var(--border-color)] bg-[var(--bg-base)] hover:border-[#fde68a]"
                                }`}
                                key={skill.name}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className={`rounded-md px-2 py-0.5 font-mono text-sm font-bold ${
                                        isInstalled
                                          ? "bg-[#d1fae5] text-[#059669] dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : "bg-[#fffbeb] text-[#d97706] dark:bg-[#1e1b4b]"
                                      }`}>
                                        {skill.name}
                                      </code>
                                      {isInstalled && (
                                        <span className="rounded-full bg-[#d1fae5] px-1.5 py-px text-[10px] font-medium text-[#059669] dark:bg-emerald-900/30 dark:text-emerald-400">
                                          已安装
                                        </span>
                                      )}
                                      {skill.skill_type && (
                                        <span className="rounded-full bg-[#fef3c7] px-1.5 py-px text-[10px] font-medium text-[#92400e]">
                                          {skill.skill_type}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-[var(--text-quaternary)]">
                                        ↓{skill.downloads} · 👍{skill.thumbs_ups}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 max-h-[80px] overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-[var(--text-tertiary)]">
                                      {skill.description || "暂无描述"}
                                    </div>
                                    {skill.author && (
                                      <div className="mt-1 text-[10px] text-[var(--text-quaternary)]">
                                        作者：{skill.author}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    type={isInstalled ? "default" : "primary"}
                                    size="small"
                                    loading={installingSkillName === skill.name}
                                    disabled={installingSkillName !== "" || isInstalled}
                                    className={`shrink-0 ${isInstalled ? "cursor-default" : ""}`}
                                    onClick={() => void installFromPlaza(skill.name)}
                                  >
                                    {isInstalled ? "已安装" : "安装"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {plazaTotalPages > 1 && (
                          <div className="mt-4 flex items-center justify-center gap-2">
                            <Button
                              size="small"
                              disabled={plazaPage <= 1}
                              onClick={() => setPlazaPage((p) => p - 1)}
                            >
                              ‹ 上一页
                            </Button>
                            <span className="text-xs text-[var(--text-quaternary)]">
                              {plazaPage} / {plazaTotalPages}
                            </span>
                            <Button
                              size="small"
                              disabled={plazaPage >= plazaTotalPages}
                              onClick={() => setPlazaPage((p) => p + 1)}
                            >
                              下一页 ›
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {showKnowledge && (
        <div className="space-y-4">
          {/* 知识库能力 */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <span>📚</span>
                  知识库能力
                </div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  开启后分身回复时可引用知识库内容，提升回答准确性。
                </div>
              </div>
              <Switch
                size="small"
                checked={kbEnabled}
                disabled={loading || saving}
                onChange={(checked) => {
                  setKbEnabled(checked);
                }}
              />
            </div>

            {kbEnabled && (
              <div className="space-y-3">
                {/* 回答策略 */}
                <div>
                  <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">回答策略</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "auto_search" as const, label: "仅知识型问题", desc: "LLM 判断是否查库（推荐）" },
                      { value: "knowledge_only" as const, label: "自动查知识库", desc: "每次都搜索" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-left transition-all ${
                          kbAnswerStrategy === opt.value
                            ? "border-[#818cf8] bg-[#eef2ff] text-[#4f46e5] dark:bg-[#1e1b4b]"
                            : "border-[var(--border-color)] hover:border-[#a5b4fc]"
                        }`}
                        onClick={() => setKbAnswerStrategy(opt.value)}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-[var(--text-quaternary)]">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 相似度阈值与搜索条数（可选，留空使用服务端兜底配置） */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      相似度阈值（可选）
                    </div>
                    <InputNumber
                      className="w-full"
                      min={0}
                      max={1}
                      step={0.05}
                      placeholder="默认 0.8（服务端兜底）"
                      value={kbSimilarityThreshold === "" ? null : Number(kbSimilarityThreshold)}
                      disabled={loading || saving}
                      onChange={(v) =>
                        setKbSimilarityThreshold(v == null || Number.isNaN(v) ? "" : String(v))
                      }
                    />
                    <div className="mt-1 text-[10px] text-[var(--text-quaternary)]">
                      搜索结果相似度 ≥ 该值时，自动读取正文并在引用处展开详情。留空则使用服务端配置。
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      搜索返回条数（可选）
                    </div>
                    <InputNumber
                      className="w-full"
                      min={1}
                      max={10}
                      step={1}
                      placeholder="默认 5（服务端兜底）"
                      value={kbSearchLimit === "" ? null : Number(kbSearchLimit)}
                      disabled={loading || saving}
                      onChange={(v) =>
                        setKbSearchLimit(v == null || Number.isNaN(v) ? "" : String(v))
                      }
                    />
                    <div className="mt-1 text-[10px] text-[var(--text-quaternary)]">
                      单次知识库搜索返回的最大条目数（1~10，避免过多影响性能）。留空则使用服务端配置。
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 保存按钮 */}
          <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-end border-t border-[var(--border-color)] bg-[var(--bg-base)]/95 px-5 py-3 backdrop-blur">
            <Button
              type="primary"
              loading={saving}
              disabled={loading}
              onClick={() => void saveConfig()}
            >
              保存配置
            </Button>
          </div>
        </div>
      )}

      {showRecords && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] px-5 py-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <span>📋</span>
                代回记录与纠错训练
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                确认合适的分身回复；遇到不合适的回复，可选择已有技能或创建新技能完成纠错训练闭环。
              </div>
            </div>
            <Button
              size="small"
              loading={loadingReplies}
              onClick={() => {
                void loadReplyRecords(false);
              }}
            >
              刷新
            </Button>
          </div>

          {/* 筛选标签 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {replyReviewFilters.map((filter) => (
              <Button
                key={filter.label}
                size="small"
                type={replyReviewFilter === filter.value ? "primary" : "default"}
                onClick={() => {
                  setReplyRecords([]);
                  setReplyNextCursor(0);
                  setReplyHasMore(false);
                  setReplyReviewFilter(filter.value);
                }}
              >
                {filter.label}{" "}
                <span className={`rounded-full px-1.5 py-px text-[10px] ${
                  replyReviewFilter === filter.value
                    ? "bg-white/30 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                }`}>
                  {replySummary[filter.countKey] ?? 0}
                </span>
              </Button>
            ))}
          </div>

          {/* 搜索筛选 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              className="w-[220px]"
              value={draftReplySenderUserID}
              placeholder="按联系人 userID 筛选"
              onChange={(event) => setDraftReplySenderUserID(event.target.value)}
              onPressEnter={() => {
                setReplyRecords([]);
                setReplyNextCursor(0);
                setReplyHasMore(false);
                setReplySenderUserID(draftReplySenderUserID.trim());
              }}
            />
            <Button
              size="small"
              onClick={() => {
                setReplyRecords([]);
                setReplyNextCursor(0);
                setReplyHasMore(false);
                setReplySenderUserID(draftReplySenderUserID.trim());
              }}
            >
              应用
            </Button>
            {replySenderUserID && (
              <Button
                size="small"
                onClick={() => {
                  setDraftReplySenderUserID("");
                  setReplySenderUserID("");
                  setReplyRecords([]);
                  setReplyNextCursor(0);
                  setReplyHasMore(false);
                }}
              >
                清空
              </Button>
            )}
          </div>

          {replyRecords.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无分身回复记录"
            />
          ) : (
            <div className="space-y-3">
              {replyRecords.map((record) => (
                <div
                  className="group rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] p-4 transition-all hover:shadow-md hover:border-[#d8b4fe]"
                  key={`${record.operationID}-${record.createdAt}`}
                >
                  {/* 头部：联系人 + 时间 */}
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <OIMAvatar
                        size={32}
                        src={getContactInfo(record.senderUserID)?.faceURL}
                        text={getContactDisplayName(record.senderUserID)}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {getContactDisplayName(record.senderUserID)}
                        </div>
                        <div className="truncate text-[11px] text-[var(--text-quaternary)]">
                          {record.senderUserID}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-xs text-[var(--text-quaternary)]">
                      {formatReplyTime(record.createdAt)}
                    </span>
                  </div>

                  {/* 触发消息 */}
                  {record.messageContent && (
                    <div className="mb-2 rounded-lg bg-[var(--bg-body)] px-3 py-2">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">收到</div>
                      <div className="truncate text-sm text-[var(--text-secondary)]">{record.messageContent}</div>
                    </div>
                  )}

                  {/* 分身回复 */}
                  <div className="mb-2 rounded-lg border-l-2 border-l-[#7c3aed] bg-gradient-to-r from-[#faf5ff]/60 to-transparent px-3 py-2.5 dark:from-purple-950/20">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#7c3aed]">
                      <span>AI 分身回复</span>
                    </div>
                    <div className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                      {record.replyText}
                    </div>
                  </div>

                  {/* 元信息 */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-quaternary)]">
                    <span className={`rounded-full px-1.5 py-px font-medium {
                      record.reviewStatus === "confirmed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    }`}>
                      {reviewStatusText(record.reviewStatus)}
                    </span>
                  </div>

                  {/* 错误提示 */}
                  {record.generatorError && (
                    <div className="mt-2 line-clamp-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                      生成异常：{record.generatorError}
                    </div>
                  )}

                  {/* 纠正训练面板 */}
                  {renderCorrectionTrainingPanel(record)}

                  {/* 操作按钮 */}
                  {record.operationID && record.reviewStatus !== "confirmed" && (
                    <div className="mt-3 flex justify-end gap-2 pt-2">
                      <Button
                        size="small"
                        disabled={
                          record.reviewStatus === "confirmed" ||
                          trainingOperationID === record.operationID
                        }
                        loading={reviewingOperationID === record.operationID}
                        onClick={() => {
                          void reviewReply(record.operationID, "confirmed");
                        }}
                      >
                        确认
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {replyHasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    size="small"
                    loading={loadingReplies}
                    onClick={() => {
                      void loadReplyRecords(true, replyNextCursor);
                    }}
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <Modal
        title={
          viewingSkill ? (
            <span className="flex items-center gap-2 font-mono text-sm">
              <span>📄</span>
              {viewingSkill.name}
            </span>
          ) : (
            "技能内容"
          )
        }
        open={viewingSkill !== null}
        footer={null}
        width={720}
        bodyStyle={{ padding: 0 }}
        onCancel={() => setViewingSkill(null)}
      >
        {loadingSkillDetail ? (
          <div className="flex items-center justify-center py-16">
            <Spin />
          </div>
        ) : viewingSkill ? (
          <div className="max-h-[70vh] overflow-auto">
            {viewingSkill.description && (
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-body)] px-5 py-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
                {viewingSkill.description}
              </div>
            )}
            <pre className="overflow-auto whitespace-pre-wrap break-words bg-[#0d1117] px-5 py-4 font-mono text-xs leading-relaxed text-[#e6edf3]">
              <code>{viewingSkill.content}</code>
            </pre>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={contactSelectorTitle}
        open={contactSelectorOpen}
        width={520}
        destroyOnClose
        okText="确认选择"
        cancelText="取消"
        onCancel={() => setContactSelectorOpen(false)}
        onOk={applyContactSelector}
      >
        <div className="mb-3 text-xs text-[var(--sub-text)]">
          已选择 {contactSelectorDraftIDs.length} 位联系人，保存配置后生效。
        </div>
        <Input
          value={contactSelectorSearch}
          allowClear
          placeholder="搜索联系人昵称、备注或 userID"
          onChange={(event) => setContactSelectorSearch(event.target.value)}
        />
        <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md border border-[#edf0f5]">
          {contactSearching ? (
            <div className="flex h-[120px] items-center justify-center">
              <Spin />
            </div>
          ) : selectorVisibleContacts.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                contactSelectorSearch.trim()
                  ? "暂无匹配联系人"
                  : "暂无本地联系人，请输入关键词搜索人员"
              }
            />
          ) : (
            selectorVisibleContacts.map((contact) => {
              const userID = contact.userID;
              const checked = contactSelectorDraftIDs.includes(userID);
              return (
                <div
                  className="flex cursor-pointer items-center justify-between border-b border-[#f2f4f7] px-3 py-2 last:border-b-0 hover:bg-[#f6fbff]"
                  key={userID}
                  onClick={() => toggleContactSelectorUser(userID, !checked)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <OIMAvatar
                      size={32}
                      src={contact.faceURL}
                      text={getContactUserDisplayName(contact)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#111827]">
                        {getContactUserDisplayName(contact)}
                      </div>
                      <div className="truncate text-xs text-[var(--sub-text)]">
                        {userID}
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={checked}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      toggleContactSelectorUser(userID, event.target.checked)
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
};

export default memo(DigitalTwinSettingPanel);
