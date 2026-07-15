import { searchAgents, type AgentInfo } from "@/api/login";

// Register type constants matching the backend
export const REGISTER_TYPE_PHONE = 0; // Phone registration
export const REGISTER_TYPE_EMAIL = 1; // Email registration
export const REGISTER_TYPE_ADMIN = 2; // Admin/notification account (our agents)
export const REGISTER_TYPE_AD = 3; // AD synchronized users

export type AgentRecommendation = Pick<AgentInfo, "userID" | "nickname" | "faceURL" | "registerType">;
export type AgentSearchPage = {
  total?: number;
  users?: AgentInfo[];
};

export type AgentSearchPageFetcher = (
  keyword: string,
  pageNumber: number,
  showNumber: number,
) => Promise<AgentSearchPage>;

// Check if a user is an agent (admin-created notification account)
// This aligns with the logic in chat list (isAgentConversation)
export const isAgentUser = (user: { registerType?: number; userID?: string }) => {
  // Admin-created notification accounts have registerType === 2
  return user.registerType === REGISTER_TYPE_ADMIN;
};

export const isDisplayableAgent = (agent: AgentInfo) =>
  Boolean(agent.userID) && agent.registerType !== REGISTER_TYPE_AD;

export const getVisibleAgentRecommendations = (
  agents: AgentInfo[],
): AgentRecommendation[] =>
  agents.filter(isDisplayableAgent).map((agent) => ({
    userID: agent.userID,
    nickname: agent.nickname || agent.userID,
    faceURL: agent.faceURL || "",
    registerType: agent.registerType,
  }));

// GroupMemberItem returned by getGroupMemberList does NOT carry registerType,
// so we cannot tell agents from the group member list directly. Instead we fetch
// the full set of agent userIDs (registerType === 2) and match group members by
// userID. The result is cached at module level since the agent set is global.
let agentUserIDSetCache: Promise<Set<string>> | null = null;

export const getAgentUserIDSet = (force = false): Promise<Set<string>> => {
  if (!force && agentUserIDSetCache) return agentUserIDSetCache;
  agentUserIDSetCache = (async () => {
    const set = new Set<string>();
    const pageSize = 200;
    let pageNumber = 1;
    for (let i = 0; i < 50; i += 1) {
      const { data } = await searchAgents("", { pageNumber, showNumber: pageSize });
      (data.users ?? []).forEach((u: AgentInfo) => {
        if (u.userID) set.add(u.userID);
      });
      if ((data.users ?? []).length < pageSize) break;
      pageNumber += 1;
    }
    return set;
  })();
  return agentUserIDSetCache;
};

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
