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
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useConversationStore } from "@/store";
import { isAgentConversation } from "@/utils/agentConversation";
import { isDigitalTwinMessage } from "@/utils/digitalTwinMessage";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";

import styles from "./conversation-item.module.scss";

interface IConversationProps {
  isActive: boolean;
  conversation: ConversationItemType;
  digitalTwinSummary?: DigitalTwinReplySummary;
}

const formatUnreadCount = (count: number) => (count > 99 ? "99+" : String(count));

const ConversationItem = ({
  isActive,
  conversation,
  digitalTwinSummary,
}: IConversationProps) => {
  const navigate = useNavigate();
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const displayName = useContactStore((state) => {
    if (conversation.groupID) return conversation.showName;
    const friend = state.friendList.find((f) => f.userID === conversation.userID);
    return friend?.remark || friend?.nickname || conversation.showName;
  });

  const toSpecifiedConversation = async () => {
    if (isActive) {
      return;
    }
    await updateCurrentConversation({ ...conversation });
    navigate(`/chat/${conversation.conversationID}`);
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

  const isSingleConversation = conversation.conversationType === SessionType.Single;
  const isAgent = isAgentConversation(conversation, latestMessage);
  const latestMessageIsDigitalTwin =
    isSingleConversation && latestMessage ? isDigitalTwinMessage(latestMessage) : false;
  const unreviewedCount = digitalTwinSummary?.unreviewed ?? 0;
  const needsFollowUpCount = digitalTwinSummary?.needsFollowUp ?? 0;

  const latestMessageTime = formatConversionTime(conversation.latestMsgSendTime);

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
              className="!bg-white"
            />
          </div>
        ) : (
          <OIMAvatar
            src={conversation.faceURL}
            isgroup={Boolean(conversation.groupID)}
            text={displayName}
            size={40}
          />
        )}
        {conversation.unreadCount > 0 && (
          <span
            className={clsx(
              styles["conversation-item-unread"],
              isAgent && styles["conversation-item-unread-agent"],
            )}
          >
            {formatUnreadCount(conversation.unreadCount)}
          </span>
        )}
        {isAgent && (
          <span className={styles["conversation-item-agent-corner"]}>AI</span>
        )}
      </div>

      <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center">
            <div className="truncate font-medium">{displayName}</div>
            {isAgent && (
              <span className="ml-2 shrink-0 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed]">
                AI
              </span>
            )}
            {latestMessageIsDigitalTwin && (
              <span className="ml-2 shrink-0 rounded bg-[#e6f4ff] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#0089ff]">
                分身已回
              </span>
            )}
            {unreviewedCount > 0 && (
              <span className="ml-1.5 shrink-0 rounded bg-[#fff3e6] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#d46b08]">
                待确认 {unreviewedCount}
              </span>
            )}
            {needsFollowUpCount > 0 && (
              <span className="ml-1.5 shrink-0 rounded bg-[#fff1f0] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#cf1322]">
                需跟进 {needsFollowUpCount}
              </span>
            )}
          </div>
          <div className="ml-2 shrink-0 text-xs text-[var(--text-placeholder)]">{latestMessageTime}</div>
        </div>

        <div className="flex items-center">
          <div className="flex min-h-[16px] flex-1 items-center overflow-hidden text-xs">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationItem);
