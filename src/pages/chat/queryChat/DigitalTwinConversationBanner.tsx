import { SessionType } from "@openim/wasm-client-sdk";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DigitalTwinReplyRecord,
  DigitalTwinReplySummary,
  listDigitalTwinReplies,
} from "@/api/digitalTwin";
import { useConversationStore, useUserStore } from "@/store";
import { DIGITAL_TWIN_REPLIES_CHANGED } from "@/utils/digitalTwinEvents";
import { publicAsset } from "@/utils/publicAsset";

const emptySummary: DigitalTwinReplySummary = {
  total: 0,
  unreviewed: 0,
  needsFollowUp: 0,
  confirmed: 0,
};

const aiIcon = publicAsset("icons/a-iconai.png");

const truncateText = (text: string, maxLength = 42) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const buildBannerText = (summary: DigitalTwinReplySummary) => {
  if (summary.unreviewed > 0) {
    return `数字分身有 ${summary.unreviewed} 条代回消息待确认`;
  }
  return "";
};

const DigitalTwinConversationBanner = () => {
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const [summary, setSummary] = useState<DigitalTwinReplySummary>(emptySummary);
  const [latestRecord, setLatestRecord] = useState<DigitalTwinReplyRecord>();
  const requestIndexRef = useRef(0);

  const senderUserID = currentConversation?.userID ?? "";
  const isSingleConversation =
    currentConversation?.conversationType === SessionType.Single;
  const conversationVersion = `${currentConversation?.latestMsg ?? ""}:${
    currentConversation?.latestMsgSendTime ?? 0
  }:${currentConversation?.unreadCount ?? 0}`;

  const loadConversationReplies = useCallback(async () => {
    const requestIndex = ++requestIndexRef.current;
    if (!selfUserID || !isSingleConversation || !senderUserID) {
      setSummary(emptySummary);
      setLatestRecord(undefined);
      return;
    }

    try {
      const response = await listDigitalTwinReplies(1, "", 0, senderUserID);
      if (requestIndex !== requestIndexRef.current) return;
      setSummary(response.data.summary ?? emptySummary);
      setLatestRecord(response.data.records?.[0]);
    } catch (error) {
      if (requestIndex !== requestIndexRef.current) return;
      console.warn("load digital twin conversation replies failed", error);
      setSummary(emptySummary);
      setLatestRecord(undefined);
    }
  }, [isSingleConversation, selfUserID, senderUserID]);

  useEffect(() => {
    void loadConversationReplies();
  }, [
    conversationVersion,
    currentConversation?.conversationID,
    loadConversationReplies,
  ]);

  useEffect(() => {
    const refreshConversationReplies = () => {
      void loadConversationReplies();
    };

    window.addEventListener(DIGITAL_TWIN_REPLIES_CHANGED, refreshConversationReplies);
    return () => {
      window.removeEventListener(
        DIGITAL_TWIN_REPLIES_CHANGED,
        refreshConversationReplies,
      );
    };
  }, [loadConversationReplies]);

  const bannerText = useMemo(() => buildBannerText(summary), [summary]);

  if (!bannerText) return null;

  return (
    <div className="border-b border-[var(--border-color)] bg-[var(--bg-body)] px-5 py-2.5">
      <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#e9d5ff]/60 bg-gradient-to-r from-[#faf5ff] to-white px-3.5 py-2.5 shadow-sm dark:from-purple-950/20 dark:to-transparent dark:border-purple-800/30">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] shadow-sm">
          <img className="h-4 w-4 object-contain brightness-0 invert" src={aiIcon} alt="" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-semibold text-[#7c3aed]">AI 分身提醒</span>
            <span className="min-w-0 truncate text-sm text-[var(--text-secondary)]">{bannerText}</span>
          </div>
          {latestRecord?.replyText && (
            <div className="mt-1 min-w-0 truncate text-xs text-[var(--text-quaternary)]">
              最近：{truncateText(latestRecord.replyText, 56)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(DigitalTwinConversationBanner);
