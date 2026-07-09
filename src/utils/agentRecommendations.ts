import type { AgentInfo } from "@/api/login";

export type AgentRecommendation = Pick<AgentInfo, "userID" | "nickname" | "faceURL">;

const isDisplayableAgent = (agent: AgentInfo) =>
  Boolean(agent.userID) && agent.registerType !== 3;

export const getVisibleAgentRecommendations = (
  agents: AgentInfo[],
): AgentRecommendation[] =>
  agents.filter(isDisplayableAgent).map((agent) => ({
    userID: agent.userID,
    nickname: agent.nickname || agent.userID,
    faceURL: agent.faceURL || "",
  }));
