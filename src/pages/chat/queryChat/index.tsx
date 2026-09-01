import { useUnmount } from "ahooks";
import { Layout } from "antd";
import { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useParams } from "react-router-dom";

import { useConversationStore } from "@/store";

import ChatContent from "./ChatContent";
import ChatFooter from "./ChatFooter";
import ChatHeader from "./ChatHeader";
import DigitalTwinConversationBanner from "./DigitalTwinConversationBanner";
import useConversationState from "./useConversationState";

export const QueryChat = () => {
  const { conversationID } = useParams();
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );

  useConversationState();

  useEffect(() => {
    if (!conversationID) return;
    window.electronAPI?.ipcSend("trayConversationOpened", { conversationID });
  }, [conversationID]);

  useUnmount(() => {
    updateCurrentConversation();
  });

  return (
    <Layout id="chat-container" className="relative overflow-hidden">
      <ChatHeader />
      <DigitalTwinConversationBanner />
      <PanelGroup direction="vertical">
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
    </Layout>
  );
};
