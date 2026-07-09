import type { AgentInfo } from "@/api/login";

export type AgentRecommendation = Pick<AgentInfo, "userID" | "nickname" | "faceURL">;
export type AgentSearchPage = {
  total?: number;
  users?: AgentInfo[];
};

export type AgentSearchPageFetcher = (
  keyword: string,
  pageNumber: number,
  showNumber: number,
) => Promise<AgentSearchPage>;

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

export const collectVisibleAgentRecommendations = async (
  fetchPage: AgentSearchPageFetcher,
  options?: {
    keyword?: string;
    pageSize?: number;
    maxPages?: number;
  },
) => {
  const keyword = options?.keyword ?? "";
  const pageSize = options?.pageSize ?? 200;
  const maxPages = options?.maxPages ?? 20;
  const allAgents: AgentInfo[] = [];
  let total: number | undefined;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await fetchPage(keyword, pageNumber, pageSize);
    const users = page.users ?? [];
    total = page.total ?? total;
    allAgents.push(...users);

    if (
      users.length < pageSize ||
      (typeof total === "number" && allAgents.length >= total)
    ) {
      break;
    }
  }

  const seen = new Set<string>();
  return getVisibleAgentRecommendations(allAgents).filter((agent) => {
    if (seen.has(agent.userID)) return false;
    seen.add(agent.userID);
    return true;
  });
};
