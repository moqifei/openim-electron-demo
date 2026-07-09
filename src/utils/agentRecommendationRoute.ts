export const AGENT_RECOMMENDATIONS_ROUTE = "/chat";

export const isAgentRecommendationsActive = (conversationID?: string) =>
  !conversationID;
