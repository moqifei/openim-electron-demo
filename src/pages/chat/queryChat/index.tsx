import { useSize, useUnmount } from "ahooks";
import { Layout } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useParams } from "react-router-dom";

import { useConversationStore } from "@/store";
import emitter from "@/utils/events";

import ChatContent from "./ChatContent";
import ChatFooter from "./ChatFooter";
import ChatHeader from "./ChatHeader";
import ConversationHistoryDrawer from "./ConversationHistoryDrawer";
import {
  DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO,
  getConversationHistoryDrawerWidth,
  getConversationHistoryDrawerWidthRatio,
} from "./ConversationHistoryDrawer/layoutHelpers";
import DigitalTwinConversationBanner from "./DigitalTwinConversationBanner";
import useConversationState from "./useConversationState";

export const QueryChat = () => {
  const { conversationID } = useParams();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDrawerRatio, setHistoryDrawerRatio] = useState(
    DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO,
  );
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerSize = useSize(chatContainerRef);
  const historyDrawerWidth = getConversationHistoryDrawerWidth(
    chatContainerSize?.width || 0,
    historyDrawerRatio,
  );
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );

  useConversationState();

  useEffect(() => {
    if (!conversationID) return;
    window.electronAPI?.ipcSend("trayConversationOpened", { conversationID });
  }, [conversationID]);

  useEffect(() => {
    const toggleHistory = () => setHistoryOpen((isOpen) => !isOpen);
    emitter.on("TOGGLE_CONVERSATION_HISTORY", toggleHistory);
    return () => emitter.off("TOGGLE_CONVERSATION_HISTORY", toggleHistory);
  }, []);

  useEffect(() => {
    setHistoryOpen(false);
  }, [conversationID]);

  const handleHistoryDrawerResizeStart = useCallback((event: MouseEvent) => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    event.preventDefault();
    const { left, width } = chatContainer.getBoundingClientRect();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setHistoryDrawerRatio(
        getConversationHistoryDrawerWidthRatio(left, width, moveEvent.clientX),
      );
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  useUnmount(() => {
    updateCurrentConversation();
  });

  return (
    <Layout
      ref={chatContainerRef}
      id="chat-container"
      className="relative overflow-hidden"
    >
      <div
        className="flex h-full min-w-0 flex-col transition-[width] duration-200"
        style={{
          width: historyOpen ? `calc(100% - ${historyDrawerWidth}px)` : "100%",
        }}
      >
        <ChatHeader />
        <DigitalTwinConversationBanner />
        <PanelGroup direction="vertical" className="min-h-0 flex-1">
          <Panel id="chat-main" order={0}>
            <ChatContent />
          </Panel>
          <PanelResizeHandle />
          <Panel
            id="chat-footer"
            order={1}
            defaultSize={25}
            maxSize={60}
            className="min-h-[200px]"
          >
            <ChatFooter />
          </Panel>
        </PanelGroup>
      </div>
      <ConversationHistoryDrawer
        conversationID={conversationID}
        width={historyDrawerWidth}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onResizeStart={handleHistoryDrawerResizeStart}
        onLocateMessage={(message) =>
          emitter.emit("LOCATE_CONVERSATION_HISTORY_MESSAGE", message)
        }
      />
    </Layout>
  );
};
