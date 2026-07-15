import { RobotOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { Empty, Layout, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { searchAgents } from "@/api/login";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import {
  AgentRecommendation,
  collectVisibleAgentRecommendations,
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
    <Layout className="no-mobile flex bg-[var(--bg-body)] px-8 py-8">
      <div className="mx-auto flex h-full w-full max-w-[720px] flex-col overflow-hidden">
        {/* 标题区 */}
        <div className="mb-6 shrink-0 text-center">
          <div className="mb-1 inline-flex items-center justify-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
              <RobotOutlined className="text-sm text-white" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              智能体
            </h1>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
            选择一个智能体开始对话
          </p>
        </div>

        {/* 内容区 */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {loading ? (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <Spin size="large" />
            </div>
          ) : agents.length > 0 ? (
            <div className="grid gap-3 pb-4 sm:grid-cols-2">
              {agents.map((agent) => (
                <button
                  key={agent.userID}
                  type="button"
                  group
                  className="group relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:shadow-lg hover:shadow-purple-100/50 dark:hover:shadow-purple-900/20 active:scale-[0.98] disabled:cursor-default disabled:opacity-70"
                  disabled={Boolean(openingAgentID)}
                  onClick={() => void openAgentChat(agent)}
                >
                  {/* 头像区 */}
                  <div className="relative">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ede9fe] to-[#ddd6fe] ring-4 ring-white dark:from-[#2e1065] dark:to-[#4c1d95] dark:ring-[#1f1235]">
                      {agent.faceURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={agent.faceURL}
                          alt={agent.nickname}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#7c3aed]">
                          {agent.nickname.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* 在线指示点 */}
                    <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1f1235]" />
                  </div>

                  {/* 信息区 */}
                  <div className="w-full text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                        {agent.nickname}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed] dark:bg-[#2e1065]/60">
                        AI
                      </span>
                    </div>

                    {/* 操作提示 */}
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--text-quaternary)] transition-colors group-hover:text-[#7c3aed]">
                      {openingAgentID === agent.userID ? (
                        <>
                          <Spin size="small" />
                          <span>{t("connect.connecting")}</span>
                        </>
                      ) : (
                        <>
                          <span>开始对话</span>
                          <svg
                            className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </div>
                  </div>

                  {/* hover 渐变光晕 */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-transparent via-transparent to-[#7c3aed]/[0.03] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-color)]">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={noAgents} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
