import { SessionType } from "@openim/wasm-client-sdk";
import { ConversationItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DigitalTwinReplySummary, listDigitalTwinReplies } from "@/api/digitalTwin";
import { DIGITAL_TWIN_REPLIES_CHANGED } from "@/utils/digitalTwinEvents";

const MAX_SUMMARY_CONVERSATIONS = 30;

export type DigitalTwinConversationSummaryMap = Record<string, DigitalTwinReplySummary>;

const shouldLoadConversationSummary = (conversation: ConversationItem) =>
  conversation.conversationType === SessionType.Single && Boolean(conversation.userID);

export const useDigitalTwinConversationSummaries = (
  conversationList: ConversationItem[],
) => {
  const [summaries, setSummaries] = useState<DigitalTwinConversationSummaryMap>({});

  const targetConversations = useMemo(
    () =>
      conversationList
        .filter(shouldLoadConversationSummary)
        .slice(0, MAX_SUMMARY_CONVERSATIONS),
    [conversationList],
  );

  const conversationSignature = useMemo(
    () =>
      targetConversations
        .map(
          (conversation) =>
            `${conversation.conversationID}:${conversation.userID}:${
              conversation.latestMsgSendTime ?? 0
            }:${conversation.unreadCount ?? 0}`,
        )
        .join("|"),
    [targetConversations],
  );

  const loadSummaries = useCallback(async () => {
    if (targetConversations.length === 0) {
      setSummaries({});
      return;
    }

    const summaryEntries = await Promise.all(
      targetConversations.map(async (conversation) => {
        try {
          const response = await listDigitalTwinReplies(1, "", 0, conversation.userID);
          return [conversation.conversationID, response.data.summary] as const;
        } catch (error) {
          console.warn("load digital twin conversation summary failed", {
            conversationID: conversation.conversationID,
            userID: conversation.userID,
            error,
          });
          return [conversation.conversationID, undefined] as const;
        }
      }),
    );

    setSummaries(() => {
      const nextSummaries: DigitalTwinConversationSummaryMap = {};
      summaryEntries.forEach(([conversationID, summary]) => {
        if (summary) {
          nextSummaries[conversationID] = summary;
        }
      });
      return nextSummaries;
    });
  }, [targetConversations]);

  useEffect(() => {
    void loadSummaries();
  }, [conversationSignature, loadSummaries]);

  useEffect(() => {
    const reloadSummaries = () => {
      void loadSummaries();
    };

    window.addEventListener(DIGITAL_TWIN_REPLIES_CHANGED, reloadSummaries);
    return () => {
      window.removeEventListener(DIGITAL_TWIN_REPLIES_CHANGED, reloadSummaries);
    };
  }, [loadSummaries]);

  return summaries;
};
