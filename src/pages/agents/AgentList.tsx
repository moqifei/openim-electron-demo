import { RobotOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { Avatar, Empty, Layout, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { searchAgents } from "@/api/login";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import {
  AgentRecommendation,
  collectVisibleAgentRecommendations,
  isAgentUser,
} from "@/utils/agentRecommendations";
import { feedbackToast } from "@/utils/common";

export const AgentList = () => {
  const { t } = useTranslation();
  const { toSpecifiedConversation } = useConversationToggle();
  const [agents, setAgents] = useState<AgentRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingAgentID, setOpeningAgentID] = useState("");
  const noAgents = t("empty.noAgents", {
    defaultValue: "暂无可用智能体",
  });

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    collectVisibleAgentRecommendations(
      async (keyword, pageNumber, showNumber) => {
        const { data } = await searchAgents(keyword, {
          pageNumber,
          showNumber,
        });
        return data;
      },
      { pageSize: 200 },
    )
      .then((visibleAgents) => {
        if (!mounted) return;
        setAgents(visibleAgents);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAgents([]);
        feedbackToast({ error });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openAgentChat = async (agent: AgentRecommendation) => {
    setOpeningAgentID(agent.userID);
    try {
      await toSpecifiedConversation({
        sourceID: agent.userID,
        sessionType: SessionType.Single,
      });
    } finally {
      setOpeningAgentID("");
    }
  };

  return (
    <Layout className="no-mobile flex bg-white px-10 py-10">
      <div className="mx-auto flex h-full w-full max-w-[980px] flex-col overflow-hidden">
        <div className="mb-7 shrink-0">
          <div className="mb-2 flex items-center gap-2 text-2xl font-medium text-[#1f2937]">
            <RobotOutlined rev={undefined} className="text-[var(--primary)]" />
            <span>智能体</span>
          </div>
          <div className="text-sm text-[var(--sub-text)]">点击智能体后直接进入对话</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex h-full min-h-[260px] items-center justify-center">
              <Spin />
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-2">
              {agents.map((agent) => (
                <button
                  key={agent.userID}
                  type="button"
                  className="group flex min-h-[124px] cursor-pointer items-center rounded-lg border border-[#e5e7eb] bg-white p-5 text-left transition hover:border-[var(--primary)] hover:bg-[#f8fafc] hover:shadow-sm disabled:cursor-default disabled:opacity-80"
                  disabled={Boolean(openingAgentID)}
                  onClick={() => void openAgentChat(agent)}
                >
                  <Avatar size={58} src={agent.faceURL || undefined}>
                    {agent.nickname.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <div className="ml-4 min-w-0 flex-1">
                    <div className="flex items-center">
                      <div className="break-words text-base font-medium leading-5 text-[#111827]">
                        {agent.nickname}
                      </div>
                      {isAgentUser(agent) && (
                        <span className="ml-2 shrink-0 rounded bg-[#f3e8ff] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#7c3aed]">
                          智能体
                        </span>
                      )}
                    </div>
                    <div className="mt-2 break-all text-xs leading-4 text-[var(--sub-text)]">
                      {agent.userID}
                    </div>
                    <div className="mt-3 text-xs text-[var(--sub-text)]">
                      {openingAgentID === agent.userID
                        ? t("connect.connecting")
                        : "点击进入对话"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[#e5e7eb]">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={noAgents} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
