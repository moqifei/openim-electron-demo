import { expect, test } from "@playwright/test";

import { getVisibleAgentRecommendations } from "../src/utils/agentRecommendations";
import {
  AGENT_RECOMMENDATIONS_ROUTE,
  isAgentRecommendationsActive,
} from "../src/utils/agentRecommendationRoute";

test("keeps only displayable recommended agents with stable fallbacks", () => {
  const agents = getVisibleAgentRecommendations(
    [
      {
        userID: "bot_writer",
        nickname: "Writer",
        faceURL: "writer.png",
        registerType: 1,
      },
      {
        userID: "ad_user",
        nickname: "Synced User",
        faceURL: "",
        registerType: 3,
      },
      {
        userID: "",
        nickname: "Broken",
        faceURL: "",
        registerType: 1,
      },
      {
        userID: "bot_helper",
        nickname: "",
        faceURL: "",
        registerType: 1,
      },
    ],
  );

  expect(agents).toEqual([
    {
      userID: "bot_writer",
      nickname: "Writer",
      faceURL: "writer.png",
    },
    {
      userID: "bot_helper",
      nickname: "bot_helper",
      faceURL: "",
    },
  ]);
});

test("keeps all displayable recommended agents by default", () => {
  const agents = Array.from({ length: 8 }, (_, index) => ({
    userID: `bot_${index}`,
    nickname: `Agent ${index}`,
    faceURL: "",
    registerType: 1,
  }));

  expect(getVisibleAgentRecommendations(agents)).toHaveLength(8);
});

test("uses chat root as the active agent recommendations entry", () => {
  expect(AGENT_RECOMMENDATIONS_ROUTE).toBe("/chat");
  expect(isAgentRecommendationsActive(undefined)).toBe(true);
  expect(isAgentRecommendationsActive("single_user_1")).toBe(false);
});
