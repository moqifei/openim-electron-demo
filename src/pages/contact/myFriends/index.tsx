import { Empty } from "antd";
import { t } from "i18next";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import OIMAvatar from "@/components/OIMAvatar";
import { useConversationStore } from "@/store";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="m-5.5 text-base font-extrabold">
        {t("placeholder.recentContact") || "最近联系人"}
      </div>
      {!conversationList.length ? (
        <Empty className="mt-[30%]" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex-1 overflow-auto">
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
              return (
                <div
                  className="mx-2 flex cursor-pointer items-center rounded-md px-3.5 py-3 hover:bg-[var(--primary-active)]"
                  onClick={() => toSpecifiedConversation(conversation)}
                >
                  <OIMAvatar
                    src={conversation.faceURL}
                    isgroup={Boolean(conversation.groupID)}
                    text={displayName}
                  />
                  <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 truncate font-medium">{displayName}</div>
                      <div className="ml-2 text-xs text-[var(--sub-text)]">
                        {formatConversionTime(conversation.latestMsgSendTime)}
                      </div>
                    </div>
                    <div className="truncate text-xs text-[rgba(81,94,112,0.5)]">
                      {latestMsgContent}
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
