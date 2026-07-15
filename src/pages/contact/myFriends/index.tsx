import { Empty } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import OIMAvatar from "@/components/OIMAvatar";
import { useConversationStore } from "@/store";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";
import { isAgentConversation } from "@/utils/agentConversation";

export const MyFriends = () => {
  const navigate = useNavigate();
  const conversationList = useConversationStore((state) => state.conversationList);
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );

  const toSpecifiedConversation = async (conversation: any) => {
    await updateCurrentConversation({ ...conversation }, true);
    navigate(`/chat/${conversation.conversationID}`);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* 页头 */}
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          {t("placeholder.recentContact") || "最近联系人"}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-quaternary)]">点击进入聊天</p>
      </div>

      {!conversationList.length ? (
        <Empty
          className="mt-[20%]"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-[var(--text-quaternary)]">
              暂无最近联系人
            </span>
          }
        />
      ) : (
        <div className="flex-1 overflow-auto px-3 pb-4">
          <Virtuoso
            className="h-full"
            data={conversationList}
            computeItemKey={(_, item) => item.conversationID}
            itemContent={(_, conversation) => {
              const displayName =
                conversation.showName || conversation.groupID || conversation.userID;
              let latestMsgContent = "";
              if (conversation.latestMsg) {
                try {
                  latestMsgContent = getConversationContent(
                    JSON.parse(conversation.latestMsg),
                  );
                } catch {
                  latestMsgContent = "";
                }
              }

              // 智能体判断
              let latestMessage: any = undefined;
              try { latestMessage = JSON.parse(conversation.latestMsg); } catch {}
              const isAgent = isAgentConversation(conversation, latestMessage);

              return (
                <div
                  className={clsx(
                    "group mx-0.5 flex cursor-pointer items-center rounded-xl px-3.5 py-3 transition-all duration-150",
                    "hover:bg-[var(--bg-hover)] active:scale-[0.99]",
                  )}
                  onClick={() => toSpecifiedConversation(conversation)}
                >
                  {/* 头像 */}
                  {isAgent ? (
                    <div className="rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] p-[2px] shadow-sm shadow-purple-200/50 dark:shadow-purple-900/20">
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

                  {/* 信息区 */}
                  <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate font-semibold text-sm text-[var(--text-primary)] group-hover:text-[#7c3aed] transition-colors">
                          {displayName}
                        </span>
                        {isAgent && (
                          <span className="shrink-0 rounded-full bg-[#ede9fe] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[#7c3aed]">
                            AI
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] leading-none text-[var(--text-quaternary)]">
                        {formatConversionTime(conversation.latestMsgSendTime)}
                      </span>
                    </div>
                    <div className="truncate text-xs leading-relaxed text-[var(--text-quaternary)]">
                      {latestMsgContent || "暂无消息"}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
};
