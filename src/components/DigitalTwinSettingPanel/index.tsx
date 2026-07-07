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
} from "antd";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteDigitalTwinSkill,
  DigitalTwinConfig,
  DigitalTwinReplyListReviewStatus,
  DigitalTwinReplyRecord,
  DigitalTwinReplyReviewStatus,
  DigitalTwinReplySummary,
  DigitalTwinSkillGenerateResponse,
  DigitalTwinSkillSummary,
  DigitalTwinTriggerMode,
  generateDigitalTwinSkill,
  getDigitalTwinOverview,
  getDigitalTwinUnreadTimeoutSummary,
  getPersistedDigitalTwinConfig,
  listDigitalTwinReplies,
  listDigitalTwinSkills,
  reviewDigitalTwinReply,
  updateDigitalTwinConfig,
} from "@/api/digitalTwin";
import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import { ADDepartmentMemberInfo, searchADMembers } from "@/api/organization";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { notifyDigitalTwinRepliesChanged } from "@/utils/digitalTwinEvents";
import { filterByFuzzyPinyin } from "@/utils/pinyin";
import { publicAsset } from "@/utils/publicAsset";

const DEFAULT_REPLY_TEXT = "我现在不方便回复，数字分身已收到你的消息。";
const digitalTwinIcon = publicAsset("icons/shuzifenshen.png");
export type DigitalTwinPanelSection = "overview" | "settings" | "skills" | "records";

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
    `- 当联系人 ${contactName} 或其他用户表达与下面“用户原始消息”相似的意思时使用。`,
    "- 当用户意图、语气或上下文与该样本相近时，优先遵循“纠正要求”。",
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
    "- 以后遇到相似场景时，避免重复“分身原回复”里的问题。",
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
  const [replyRecords, setReplyRecords] = useState<DigitalTwinReplyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [reviewingOperationID, setReviewingOperationID] = useState("");
  const [trainingOperationID, setTrainingOperationID] = useState("");
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

  const applyConfig = (nextConfig?: DigitalTwinConfig) => {
    const normalized = normalizeConfig(nextConfig);
    setConfig(normalized);
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
    async (showError = false) => {
      if (!selfUserID) return;
      try {
        const response = await getDigitalTwinOverview();
        applyConfig(response.data.config);
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
    const summaryTimer = window.setInterval(() => {
      void loadOverview();
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

    const skillName = normalizeSkillNameInput(
      draftCorrectionSkillNames[record.operationID] || "",
    );
    if (!skillName) {
      feedbackToast({ msg: "请选择已有技能，或填写英文技能名称，例如 reply-greeting" });
      return;
    }
    if (skillName !== draftCorrectionSkillNames[record.operationID]) {
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
      setLastGeneratedSkill(response.data);
      await reviewDigitalTwinReply(
        record.operationID,
        "confirmed",
        `已训练：${response.data.skillName}\n${correction}`,
      );
      await loadSkills();
      await loadReplyRecords();
      notifyDigitalTwinRepliesChanged();
      feedbackToast({ msg: "纠正已训练，后续相似场景会优先参考" });
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
    setGeneratingSkill(true);
    try {
      const response = await generateDigitalTwinSkill(skillName, description);
      setLastGeneratedSkill(response.data);
      setDraftSkillDescription("");
      await loadSkills();
      feedbackToast({ msg: `技能 ${response.data.skillName} 已生成` });
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
          maxLength={500}
          placeholder="例如：以后遇到这类问题，先简短确认对方意图，再给出具体建议；不要只回复“收到”。"
          onChange={(event) =>
            setDraftReviewNotes((prevNotes) => ({
              ...prevNotes,
              [record.operationID as string]: event.target.value,
            }))
          }
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-[#98a2b3]">
            已输入 {correctionText.length}/500，训练后下一轮 Orange 调用会加载该技能。
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
            纠正并训练
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#f7f9fc] p-5 text-[#1f2937]">
      {showOverview && (
        <div className="mb-5 overflow-hidden rounded-lg bg-white shadow-[0_10px_30px_rgba(31,41,55,0.08)]">
          <div className="bg-gradient-to-br from-[#eaf5ff] via-[#f7fbff] to-white px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0089ff] shadow-[0_8px_18px_rgba(0,137,255,0.24)]">
                  <img
                    className="h-7 w-7 object-contain"
                    src={digitalTwinIcon}
                    alt=""
                  />
                </div>
                <div className="ml-3 min-w-0">
                  <div className="text-lg font-semibold text-[#111827]">
                    我的数字分身
                  </div>
                  <div className="mt-1 truncate text-xs text-[#667085]">
                    当前用户：{selfInfo.nickname || selfUserID}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Switch
                  className="bg-[#8e9aaf]"
                  checked={config.enabled}
                  loading={loading || switching}
                  onChange={(checked) => {
                    void updateEnabled(checked);
                  }}
                />
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    config.enabled
                      ? "bg-[#e7f8ef] text-[#039855]"
                      : "bg-[#f2f4f7] text-[#667085]"
                  }`}
                >
                  {config.enabled ? "已开启" : "未开启"}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-md bg-white/80 px-3 py-2">
                <div className="text-lg font-semibold text-[#0089ff]">
                  {skills.length}
                </div>
                <div className="text-xs text-[#667085]">已安装技能</div>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2">
                <div className="text-lg font-semibold text-[#0089ff]">
                  {pendingUnreadTimeoutCount}
                </div>
                <div className="text-xs text-[#667085]">待接管消息</div>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2">
                <div className="text-lg font-semibold text-[#0089ff]">
                  {replySummary.unreviewed ?? 0}
                </div>
                <div className="text-xs text-[#667085]">待确认代回</div>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2">
                <div className="text-lg font-semibold text-[#0089ff]">
                  {replySummary.total ?? 0}
                </div>
                <div className="text-xs text-[#667085]">累计代回</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 text-xs leading-5 text-[#667085]">
            开启后，数字分身会按策略代为回复单聊消息；你可以确认正确回复，也可以把不合适的回复纠正成训练技能。
          </div>
        </div>
      )}

      {showOverview && (
        <div className="rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#111827]">
                最近代回与纠错训练
              </div>
              <div className="mt-1 text-xs text-[#667085]">
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
            <div className="space-y-2">
              {overviewLatestReplies.map((record) => (
                <div
                  className="rounded-md border border-[#edf0f5] bg-[#fbfdff] px-3 py-2"
                  key={`${record.operationID}-${record.createdAt}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#98a2b3]">
                    <span className="truncate">
                      联系人：{getContactDisplayName(record.senderUserID)}
                    </span>
                    <span className="shrink-0">
                      {formatReplyTime(record.createdAt)}
                    </span>
                  </div>
                  {record.messageContent && (
                    <div className="mb-1 truncate text-xs text-[#667085]">
                      收到：{truncateText(record.messageContent)}
                    </div>
                  )}
                  <div className="line-clamp-2 text-sm text-[#111827]">
                    分身回复：{record.replyText}
                  </div>
                  <div className="mt-1 text-xs text-[#98a2b3]">
                    状态：{reviewStatusText(record.reviewStatus)} · 来源：
                    {record.replySource}
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
          <div className="mb-4 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3">
              <div className="text-sm font-semibold text-[#111827]">自动接管策略</div>
              <div className="mt-1 text-xs text-[#667085]">
                设置分身什么时候接管，以及接管前需要等待多久。
              </div>
            </div>
            <div className="space-y-2">
              {triggerModeOptions.map((option) => (
                <button
                  className={`w-full rounded-md border px-3 py-2 text-left transition-all ${
                    draftTriggerMode === option.value
                      ? "border-[#0089ff] bg-[#eef7ff] shadow-[0_4px_10px_rgba(0,137,255,0.08)]"
                      : "border-[#edf0f5] bg-white hover:border-[#b9dcff]"
                  } ${option.disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={option.disabled || loading || saving}
                  key={option.value}
                  type="button"
                  onClick={() => setDraftTriggerMode(option.value)}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-xs text-[var(--sub-text)]">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
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
              <span className="text-xs text-[var(--sub-text)]">
                秒后触发；触发前会再次检查开关、时间段、联系人范围和冷却。
              </span>
            </div>
            {draftTriggerMode === "unread_timeout" && (
              <div className="mt-2 rounded bg-[#f6fbff] px-2 py-1 text-xs text-[#0089ff]">
                当前有 {pendingUnreadTimeoutCount} 条消息等待分身超时接管。
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3">
              <div className="text-sm font-semibold text-[#111827]">回复风格</div>
              <div className="mt-1 text-xs text-[#667085]">
                让分身知道默认怎么说，以及 Orange 不可用时如何兜底。
              </div>
            </div>
            <div className="mb-1 text-xs font-medium text-[#667085]">兜底回复</div>
            <Input.TextArea
              value={draftReplyText}
              rows={4}
              maxLength={300}
              showCount
              disabled={loading || saving}
              placeholder="当 Orange 暂时不可用时使用这段回复"
              onChange={(event) => setDraftReplyText(event.target.value)}
            />

            <div className="mb-1 mt-4 text-xs font-medium text-[#667085]">
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

          <div className="mb-4 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-[#111827]">
              同一联系人回复间隔
            </div>
            <div className="mb-3 text-xs text-[#667085]">
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
              <span className="text-xs text-[var(--sub-text)]">
                秒内只回复一次，0 表示每条消息都可触发分身。
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#111827]">
                  自动托管时间段
                </div>
                <div className="mt-1 text-xs text-[#667085]">
                  关闭时全天可自动回复；开启后只在指定时间段内由分身接管。
                </div>
              </div>
              <Switch
                className="bg-[#8e9aaf]"
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
                <span className="text-xs text-[var(--sub-text)]">到</span>
                <Input
                  className="w-[120px]"
                  type="time"
                  value={minuteToTimeValue(draftScheduleEndMinute)}
                  disabled={loading || saving}
                  onChange={(event) =>
                    setDraftScheduleEndMinute(timeValueToMinute(event.target.value))
                  }
                />
                <span className="text-xs text-[var(--sub-text)]">
                  支持跨午夜，当前时区 {getLocalTimezone()}。
                </span>
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-[#111827]">联系人范围</div>
            <div className="mb-3 text-xs text-[#667085]">
              默认所有联系人都可触发分身；设置“只回复”后只对列表内联系人生效。不要回复名单优先。
            </div>
            <div className="mb-3 rounded-md border border-[#edf0f5] bg-[#fbfdff] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#667085]">
                    只回复这些联系人
                  </div>
                  <div className="mt-1 text-xs text-[var(--sub-text)]">
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
                <div className="rounded bg-white px-3 py-2 text-xs text-[var(--sub-text)]">
                  暂未限制联系人范围
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedAllowedSenderUserIDs.map((userID) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[#d8ebff] bg-white px-2 py-1 text-xs text-[#27415f]"
                      key={userID}
                    >
                      {getContactDisplayName(userID)}
                      <button
                        className="text-[#98a2b3] hover:text-[#f04438]"
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
            <div className="rounded-md border border-[#edf0f5] bg-[#fbfdff] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#667085]">
                    不要回复这些联系人
                  </div>
                  <div className="mt-1 text-xs text-[var(--sub-text)]">
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
                <div className="rounded bg-white px-3 py-2 text-xs text-[var(--sub-text)]">
                  暂未排除联系人
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedBlockedSenderUserIDs.map((userID) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-[#ffe1de] bg-white px-2 py-1 text-xs text-[#912018]"
                      key={userID}
                    >
                      {getContactDisplayName(userID)}
                      <button
                        className="text-[#98a2b3] hover:text-[#f04438]"
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

          <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between border-t border-[#edf0f5] bg-white/95 px-5 py-3 backdrop-blur">
            <div className="text-xs text-[var(--sub-text)]">
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
        <div className="mt-5 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3">
            <div className="text-sm font-semibold text-[#111827]">分身技能</div>
            <div className="mt-1 text-xs text-[#667085]">
              用一句话生成技能，让分身在特定场景下更稳定地按你的偏好回复。
            </div>
          </div>
          <div className="mb-3">
            <div className="mb-1 text-xs text-[var(--sub-text)]">技能目录名</div>
            <Input
              value={draftSkillName}
              maxLength={64}
              disabled={loading || generatingSkill}
              placeholder="例如：pome"
              onChange={(event) => setDraftSkillName(event.target.value)}
            />
          </div>
          <div className="mb-3">
            <div className="mb-1 text-xs text-[var(--sub-text)]">技能需求</div>
            <Input.TextArea
              value={draftSkillDescription}
              rows={4}
              maxLength={800}
              showCount
              disabled={loading || generatingSkill}
              placeholder="例如：用户让我作诗时，返回静夜思、李白的诗句"
              onChange={(event) => setDraftSkillDescription(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-[var(--sub-text)]">
              {lastGeneratedSkill ? (
                <span className="truncate">
                  已安装：{lastGeneratedSkill.skillName} · {lastGeneratedSkill.source}
                </span>
              ) : (
                "生成后会立即写入分身工作区，下一轮 Orange 调用可读取。"
              )}
            </div>
            <Button
              type="primary"
              loading={generatingSkill}
              disabled={loading}
              onClick={() => {
                void generateSkill();
              }}
            >
              生成技能
            </Button>
          </div>
          <div className="mt-4 border-t border-[#edf0f5] pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">已安装技能</div>
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
                description="暂无自定义技能"
              />
            ) : (
              <div className="space-y-2">
                {skills.map((skill) => (
                  <div
                    className="rounded-md border border-[#edf0f5] bg-white px-3 py-2"
                    key={skill.name}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{skill.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-[var(--sub-text)]">
                          {skill.description ||
                            "暂无描述，建议重新生成以提升触发稳定性。"}
                        </div>
                        {skill.updatedAt ? (
                          <div className="mt-1 text-xs text-[var(--sub-text)]">
                            更新：{new Date(skill.updatedAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
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
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRecords && (
        <div className="mt-5 rounded-lg border border-[#edf0f5] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#111827]">
                代回记录与纠错训练
              </div>
              <div className="mt-1 text-xs text-[#667085]">
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
                {filter.label} {replySummary[filter.countKey] ?? 0}
              </Button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
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
            <div className="space-y-2">
              {replyRecords.map((record) => (
                <div
                  className="rounded-md border border-[#edf0f5] bg-white px-3 py-2"
                  key={`${record.operationID}-${record.createdAt}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--sub-text)]">
                    <div className="flex min-w-0 items-center gap-2">
                      <OIMAvatar
                        size={28}
                        src={getContactInfo(record.senderUserID)?.faceURL}
                        text={getContactDisplayName(record.senderUserID)}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#111827]">
                          {getContactDisplayName(record.senderUserID)}
                        </div>
                        <div className="truncate text-xs text-[var(--sub-text)]">
                          {record.senderUserID}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0">
                      {formatReplyTime(record.createdAt)}
                    </span>
                  </div>
                  {record.messageContent && (
                    <div className="mb-1 truncate text-xs text-[var(--sub-text)]">
                      触发消息：{record.messageContent}
                    </div>
                  )}
                  <div className="line-clamp-2 text-sm text-[var(--primary-text)]">
                    {record.replyText}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--sub-text)]">
                    <span>来源：{record.replySource}</span>
                    {record.configSource && <span>配置：{record.configSource}</span>}
                    <span>状态：{reviewStatusText(record.reviewStatus)}</span>
                  </div>
                  {record.generatorError && (
                    <div className="mt-1 line-clamp-2 text-xs text-[#f04438]">
                      生成异常：{record.generatorError}
                    </div>
                  )}
                  {renderCorrectionTrainingPanel(record)}
                  {record.operationID && (
                    <div className="mt-2 flex justify-end gap-2">
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
                <div className="flex justify-center pt-1">
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
