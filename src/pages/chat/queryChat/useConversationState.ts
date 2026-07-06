import { useLatest, useThrottleFn, useUpdateEffect } from "ahooks";
import { useEffect } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import {
  canAutoMarkConversationAsRead,
  initReadVisibilityMonitor,
  READ_VISIBILITY_CHANGED,
} from "@/utils/readVisibility";

export default function useConversationState() {
  const syncState = useUserStore((state) => state.syncState);
  const latestSyncState = useLatest(syncState);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const latestCurrentConversation = useLatest(currentConversation);

  useUpdateEffect(() => {
    if (syncState !== "loading") {
      checkConversationState();
    }
  }, [syncState]);

  useUpdateEffect(() => {
    throttleCheckConversationState();
  }, [currentConversation?.unreadCount]);

  useEffect(() => {
    initReadVisibilityMonitor();
    checkConversationState();
  }, [currentConversation?.conversationID]);

  useEffect(() => {
    const handleReadVisibilityChange = () => {
      throttleCheckConversationState();
    };
    window.addEventListener(READ_VISIBILITY_CHANGED, handleReadVisibilityChange);
    return () => {
      window.removeEventListener(READ_VISIBILITY_CHANGED, handleReadVisibilityChange);
    };
  }, []);

  const checkConversationState = () => {
    if (!latestCurrentConversation.current || latestSyncState.current === "loading")
      return;

    if (latestCurrentConversation.current.unreadCount > 0) {
      if (!canAutoMarkConversationAsRead()) {
        console.log("[read] skip auto mark as read: window is not actively readable", {
          conversationID: latestCurrentConversation.current.conversationID,
          unreadCount: latestCurrentConversation.current.unreadCount,
        });
        return;
      }
      IMSDK.markConversationMessageAsRead(
        latestCurrentConversation.current.conversationID,
      );
    }
  };

  const { run: throttleCheckConversationState } = useThrottleFn(
    checkConversationState,
    { wait: 2000, leading: false },
  );

  return {
    currentConversation,
  };
}
