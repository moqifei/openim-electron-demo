import { RobotOutlined } from "@ant-design/icons";
import clsx from "clsx";
import { t } from "i18next";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import sync from "@/assets/images/common/sync.png";
import sync_error from "@/assets/images/common/sync_error.png";
import FlexibleSider from "@/components/FlexibleSider";
import { useConversationStore, useUserStore } from "@/store";
import {
  AGENT_RECOMMENDATIONS_ROUTE,
  isAgentRecommendationsActive,
} from "@/utils/agentRecommendationRoute";

import ConversationItemComp from "./ConversationItem";
import styles from "./index.module.scss";
import { useDigitalTwinConversationSummaries } from "./useDigitalTwinConversationSummaries";

const ConnectBar = () => {
  const userStore = useUserStore();
  const showLoading =
    userStore.syncState === "loading" || userStore.connectState === "loading";
  const showFailed =
    userStore.syncState === "failed" || userStore.connectState === "failed";

  const loadingTip =
    userStore.syncState === "loading" ? t("connect.syncing") : t("connect.connecting");

  const errorTip =
    userStore.syncState === "failed"
      ? t("connect.syncFailed")
      : t("connect.connectFailed");

  if (userStore.reinstall) {
    return null;
  }

  return (
    <>
      {showLoading && (
        <div className="flex h-6 items-center justify-center bg-[#0089FF] bg-opacity-10">
          <img
            src={sync}
            alt="sync"
            className={clsx("mr-1 h-3 w-3 ", styles.loading)}
          />
          <span className=" text-xs text-[#0089FF]">{loadingTip}</span>
        </div>
      )}
      {showFailed && (
        <div className="flex h-6 items-center justify-center bg-[#FF381F] bg-opacity-15">
          <img src={sync_error} alt="sync" className="mr-1 h-3 w-3" />
          <span className=" text-xs text-[#FF381F]">{errorTip}</span>
        </div>
      )}
    </>
  );
};

const ConversationSider = () => {
  const { conversationID } = useParams();
  const navigate = useNavigate();
  const conversationList = useConversationStore((state) => state.conversationList);
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const digitalTwinSummaries = useDigitalTwinConversationSummaries(conversationList);
  const virtuoso = useRef<VirtuosoHandle>(null);
  const hasmore = useRef(true);
  const loading = useRef(false);
  const agentRecommendationsActive = isAgentRecommendationsActive(conversationID);

  const endReached = async () => {
    if (!hasmore.current || loading.current) return;
    loading.current = true;
    hasmore.current = await getConversationListByReq(true);
    loading.current = false;
  };

  const showAgentRecommendations = async () => {
    if (agentRecommendationsActive) {
      return;
    }
    await updateCurrentConversation();
    navigate(AGENT_RECOMMENDATIONS_ROUTE);
  };

  return (
    <div>
      <ConnectBar />
      <FlexibleSider
        needHidden={Boolean(conversationID)}
        wrapClassName="left-2 right-2 top-1.5 flex flex-col"
      >
        <button
          type="button"
          aria-pressed={agentRecommendationsActive}
          className={clsx(
            "mb-2 flex w-full items-center rounded-md border px-3 py-2 text-left transition",
            agentRecommendationsActive
              ? "border-[var(--primary)] bg-[var(--primary-active)]"
              : "border-transparent bg-[#f8fafc] hover:bg-[var(--primary-active)]",
          )}
          onClick={() => {
            void showAgentRecommendations();
          }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef2ff] text-[var(--primary)]">
            <RobotOutlined rev={undefined} />
          </span>
          <span className="ml-3 min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[#111827]">
              {t("placeholder.agentRecommendations", {
                defaultValue: "智能体推荐",
              })}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[var(--sub-text)]">
              {t("placeholder.viewAllAgents", {
                defaultValue: "查看全部智能体",
              })}
            </span>
          </span>
        </button>
        <Virtuoso
          className="min-h-0 flex-1"
          data={conversationList}
          ref={virtuoso}
          endReached={() => {
            void endReached();
          }}
          computeItemKey={(_, item) => item.conversationID}
          itemContent={(_, conversation) => (
            <ConversationItemComp
              isActive={conversationID === conversation.conversationID}
              conversation={conversation}
              digitalTwinSummary={digitalTwinSummaries[conversation.conversationID]}
            />
          )}
        />
      </FlexibleSider>
    </div>
  );
};

export default ConversationSider;
