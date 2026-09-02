import { BellOutlined, EditOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import type {
  ConversationItem,
  ConversationItem as ConversationItemType,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { DigitalTwinReplySummary } from "@/api/digitalTwin";
import { getCleanText } from "@/components/CKEditor/utils";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useConversationStore } from "@/store";
import { isAgentConversation } from "@/utils/agentConversation";
import { isConversationDoNotDisturb } from "@/utils/conversationNotification";
import { isDigitalTwinMessage } from "@/utils/digitalTwinMessage";
import emitter from "@/utils/events";
import {
  formatConversionTime,
  getConversationContent,
  isGroupSession,
} from "@/utils/imCommon";

import styles from "./conversation-item.module.scss";

interface IConversationProps {
  isActive: boolean;
  conversation: ConversationItemType;
  digitalTwinSummary?: DigitalTwinReplySummary;
}

const formatUnreadCount = (count: number) => (count > 99 ? "99+" : String(count));

const MAX_DRAFT_PREVIEW_LENGTH = 20;

const ConversationItem = ({
  isActive,
  conversation,
  digitalTwinSummary,
}: IConversationProps) => {
  const navigate = useNavigate();
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const draftText = useConversationStore((state) =>
    state.getConversationDraft(conversation.conversationID),
  );
  const displayName = useContactStore((state) => {
    if (conversation.groupID) return conversation.showName;
    const friend = state.friendList.find((f) => f.userID === conversation.userID);
    return friend?.remark || friend?.nickname || conversation.showName;
  });

  const toSpecifiedConversation = async () => {
    if (isActive) {
      window.electronAPI?.ipcSend("trayConversationOpened", {
        conversationID: conversation.conversationID,
      });
      return;
    }
    await updateCurrentConversation({ ...conversation });
    navigate(`/chat/${conversation.conversationID}`);
    window.electronAPI?.ipcSend("trayConversationOpened", {
      conversationID: conversation.conversationID,
    });
  };

  const latestMessage = useMemo(() => {
    if (!conversation.latestMsg) {
      return undefined;
    }
    try {
      return JSON.parse(conversation.latestMsg) as MessageItem;
    } catch (error) {
      return undefined;
    }
  }, [conversation.latestMsg]);

  const latestMessageContent = useMemo(() => {
    if (!latestMessage) {
      return "";
    }
    try {
      return getConversationContent(latestMessage);
    } catch (error) {
      return t("messageDescription.catchMessage");
    }
  }, [latestMessage]);

  const draftPreview = useMemo(() => {
    if (!draftText) return null;
    const clean = getCleanText(draftText);
    if (!clean) return null;
    return clean.length > MAX_DRAFT_PREVIEW_LENGTH
      ? `${clean.slice(0, MAX_DRAFT_PREVIEW_LENGTH)}...`
      : clean;
  }, [draftText]);

  const isSingleConversation = conversation.conversationType === SessionType.Single;
  const isGroupConversation = isGroupSession(conversation.conversationType);
  const isDoNotDisturb = isConversationDoNotDisturb(conversation);
  const isAgent = isAgentConversation(conversation, latestMessage);
  const latestMessageIsDigitalTwin =
    isSingleConversation && latestMessage ? isDigitalTwinMessage(latestMessage) : false;
  const unreviewedCount = digitalTwinSummary?.unreviewed ?? 0;
  const needsFollowUpCount = digitalTwinSummary?.needsFollowUp ?? 0;

  const latestMessageTime = formatConversionTime(conversation.latestMsgSendTime);

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSingleConversation && conversation.userID) {
      emitter.emit("OPEN_USER_CARD", { userID: conversation.userID });
    }
  };

  return (
    <div
      className={clsx(
        styles["conversation-item"],
        isActive &&
          "!bg-[var(--primary-active)] before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-md before:bg-[var(--primary)]",
      )}
      onClick={() => {
        void toSpecifiedConversation();
      }}
    >
      <div className="relative shrink-0">
        {isAgent ? (
          <div className="rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] p-[2px]">
            <OIMAvatar
              src={conversation.faceURL}
              isgroup={Boolean(conversation.groupID)}
              text={displayName}
              size={36}
              color="#7c3aed"
              className="cursor-pointer !bg-white"
              onClick={handleAvatarClick}
            />
          </div>
        ) : (
          <OIMAvatar
            src={conversation.faceURL}
            isgroup={Boolean(conversation.groupID)}
            text={displayName}
            size={40}
            className="cursor-pointer"
            onClick={handleAvatarClick}
          />
        )}
        {isAgent && (
          <span className={styles["conversation-item-agent-corner"]}>AI</span>
        )}
      </div>

      <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
        <div className="flex min-w-0 items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            <div className="min-w-[36px] truncate font-medium">{displayName}</div>
            {isAgent && (
              <span className="ml-2 min-w-0 truncate rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed]">
                AI
              </span>
            )}
            {latestMessageIsDigitalTwin && (
              <span className="ml-2 min-w-0 truncate rounded bg-[#e6f4ff] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#0089ff]">
                分身已回
              </span>
            )}
            {unreviewedCount > 0 && (
              <span className="ml-1.5 min-w-0 truncate rounded bg-[#fff3e6] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#d46b08]">
                待确认 {unreviewedCount}
              </span>
            )}
            {needsFollowUpCount > 0 && (
              <span className="ml-1.5 min-w-0 truncate rounded bg-[#fff1f0] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#cf1322]">
                需跟进 {needsFollowUpCount}
              </span>
            )}
          </div>
          <div className="ml-2 flex shrink-0 items-center">
            <div className="text-xs text-[var(--text-placeholder)]">
              {latestMessageTime}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between">
          <div className="flex min-h-[16px] flex-1 items-center overflow-hidden text-xs">
            {draftPreview !== null && !isActive ? (
              /* Draft preview — shown when not active and draft exists */
              <div className={styles["conversation-item-draft"]}>
                <EditOutlined className="mr-1 shrink-0 text-[11px]" />
                <span className="truncate">{draftPreview}</span>
              </div>
            ) : (
              <>
                {latestMessageIsDigitalTwin && (
                  <span className="mr-1 shrink-0 text-[#0089ff]">
                    分身已代回
                    {conversation.unreadCount > 0
                      ? ` · 未读 ${conversation.unreadCount}`
                      : ""}
                    :
                  </span>
                )}
                <div
                  className="truncate text-xs text-[var(--text-tertiary)]"
                  dangerouslySetInnerHTML={{
                    __html: latestMessageContent,
                  }}
                ></div>
              </>
            )}
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {isGroupConversation && isDoNotDisturb && (
              <span
                className="relative inline-flex h-4 w-4 items-center justify-center leading-none text-[var(--text-tertiary)]"
                title={t("placeholder.notNotify")}
                aria-label={t("placeholder.notNotify")}
              >
                <BellOutlined className="text-[14px]" aria-hidden="true" />
                <span
                  className="absolute left-1/2 top-1/2 z-10 h-px w-[15px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[var(--text-tertiary)]"
                  aria-hidden="true"
                />
              </span>
            )}
            {conversation.unreadCount > 0 && (
              <span
                className={clsx(
                  styles["conversation-item-unread-right"],
                  isAgent && styles["conversation-item-unread-agent"],
                )}
              >
                {formatUnreadCount(conversation.unreadCount)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationItem);
