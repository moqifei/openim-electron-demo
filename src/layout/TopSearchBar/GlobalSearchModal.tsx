import { CloseOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import {
  FriendUserItem,
  GroupItem,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { Avatar, Empty, Input, InputRef, Spin, Tabs } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AgentInfo, searchAgents } from "@/api/login";
import { ADDepartmentMemberInfo, searchADMembers } from "@/api/organization";
import OIMAvatar from "@/components/OIMAvatar";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useConversationStore } from "@/store";
import { isDisplayableAgent } from "@/utils/agentRecommendations";
import { feedbackToast } from "@/utils/common";
import { filterByFuzzyPinyin } from "@/utils/pinyin";

type SearchTab =
  | "overview"
  | "contacts"
  | "agents"
  | "adMembers"
  | "groups"
  | "chatHistory"
  | "documents";

interface ChatHistoryItem {
  conversationID: string;
  showName: string;
  faceURL: string;
  conversationType: SessionType;
  messageCount: number;
  latestMatchMessage?: MessageItem;
  userID?: string;
  groupID?: string;
}

/** 搜索智能体结果项 */
interface AgentSearchResult {
  userID: string;
  nickname: string;
  faceURL: string;
}

/** 搜索AD人员结果项 */
interface ADMemberSearchResult {
  userID: string;
  nickname: string;
  faceURL: string;
  displayName: string;
  position: string;
  email: string;
  departmentName: string;
}

interface SearchResults {
  contacts: FriendUserItem[];
  agents: AgentSearchResult[];
  adMembers: ADMemberSearchResult[];
  groups: GroupItem[];
  chatHistory: ChatHistoryItem[];
  totalContacts: number;
  totalAgents: number;
  totalADMembers: number;
  totalGroups: number;
  totalChatHistory: number;
}

const MAX_OVERVIEW_ITEMS = 3;

/** 解析 LDAP DN 字符串,提取第一个 ou 值作为部门名 */
const parseDeptDN = (dn: string): string => {
  if (!dn) return "";
  const parts = dn.split(",");
  for (const part of parts) {
    const t = part.trim();
    if (t.toLowerCase().startsWith("ou=")) return t.substring(3);
  }
  return "";
};

const GlobalSearchModal: ForwardRefRenderFunction<OverlayVisibleHandle> = (_, ref) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("overview");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    contacts: [],
    agents: [],
    adMembers: [],
    groups: [],
    chatHistory: [],
    totalContacts: 0,
    totalAgents: 0,
    totalADMembers: 0,
    totalGroups: 0,
    totalChatHistory: 0,
  });
  const inputRef = useRef<InputRef>(null);
  const cancelledRef = useRef(false);
  const { toSpecifiedConversation } = useConversationToggle();

  const friendList = useContactStore((state) => state.friendList);
  const groupList = useContactStore((state) => state.groupList);
  const conversationList = useConversationStore((state) => state.conversationList);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOverlayOpen]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!keyword.trim()) {
      setResults({
        contacts: [],
        agents: [],
        adMembers: [],
        groups: [],
        chatHistory: [],
        totalContacts: 0,
        totalAgents: 0,
        totalADMembers: 0,
        totalGroups: 0,
        totalChatHistory: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      (async () => {
        const trimmed = keyword.trim().toLowerCase();

        // 1. Contacts: merge friendList + single conversation users
        const conversationContacts: FriendUserItem[] = conversationList
          .filter(
            (c) => c.conversationType === SessionType.Single && c.userID,
          )
          .map(
            (c) =>
              ({
                userID: c.userID!,
                nickname: c.showName || c.userID!,
                faceURL: c.faceURL || "",
                addSource: 0,
                createTime: 0,
                ex: "",
                operatorUserID: "",
                ownerUserID: "",
                remark: "",
                isPinned: false,
                attachedInfo: "",
              }) as FriendUserItem,
          );

        const allContactsMap = new Map<string, FriendUserItem>();
        [...friendList, ...conversationContacts].forEach((item) => {
          if (!allContactsMap.has(item.userID)) {
            allContactsMap.set(item.userID, item);
          }
        });

        const mappedContacts = Array.from(allContactsMap.values()).map(
          (f) => ({
            ...f,
            nickname: f.nickname || f.remark || f.userID,
          }),
        );
        const contactResults = filterByFuzzyPinyin(
          mappedContacts,
          trimmed,
        );

        // 2. Groups
        const mappedGroups = groupList.map((g) => ({
          ...g,
          nickname: g.groupName || g.groupID,
        }));
        const groupResults = filterByFuzzyPinyin(
          mappedGroups,
          trimmed,
        );

        // 3. Chat history: search message content via SDK
        let chatHistoryResults: ChatHistoryItem[] = [];
        try {
          const convs = conversationList.slice(0, 50);
          const searchPromises = convs.map(async (conv) => {
            try {
              const { data } = await IMSDK.searchLocalMessages({
                conversationID: conv.conversationID,
                keywordList: [trimmed],
                pageIndex: 1,
                count: 1,
              });
              if (
                data.totalCount > 0 &&
                data.searchResultItems &&
                data.searchResultItems.length > 0
              ) {
                const item = data.searchResultItems[0];
                return {
                  conversationID: conv.conversationID,
                  showName: conv.showName,
                  faceURL: conv.faceURL,
                  conversationType: conv.conversationType,
                  messageCount: item.messageCount,
                  latestMatchMessage: item.messageList?.[0],
                  userID: conv.userID,
                  groupID: conv.groupID,
                } as ChatHistoryItem;
              }
              return null;
            } catch {
              return null;
            }
          });
          const searchResults = await Promise.all(searchPromises);
          chatHistoryResults = searchResults.filter(
            Boolean,
          ) as ChatHistoryItem[];
        } catch (error) {
          console.error("search messages error:", error);
        }

        const sliceLimit =
          activeTab === "overview" ? MAX_OVERVIEW_ITEMS : 50;

        // 4. Agents (智能体)
        let agentResults: AgentSearchResult[] = [];
        try {
          const { data } = await searchAgents(trimmed);
          agentResults = (data.users || [])
            .filter(isDisplayableAgent)
            .map((a: AgentInfo) => ({
              userID: a.userID,
              nickname: a.nickname || a.userID,
              faceURL: a.faceURL || "",
            }));
        } catch {
          // 搜索失败时静默,不阻断其他结果
        }

        // 5. AD Members (AD组织架构人员)
        let adMemberResults: ADMemberSearchResult[] = [];
        try {
          const { data: adData } = await searchADMembers({
            keyword: trimmed,
            pagination: { pageNumber: 1, showNumber: 200 },
          });
          adMemberResults = (adData.members || []).map(
            (m: ADDepartmentMemberInfo) => {
              const url = (m.faceURL || m.avatar || "").trim();
              return {
                userID: m.userID || m.username,
                nickname: m.nickname || m.displayName || m.username,
                faceURL:
                  url && url !== "null" && url !== "undefined" ? url : "",
                displayName: m.displayName || "",
                position: (m.position || "").trim(),
                email: m.email || "",
                departmentName:
                  (m.departmentName || "").trim() ||
                  parseDeptDN(m.departmentID || ""),
              };
            },
          );
        } catch {
          // 搜索失败时静默
        }

        // Pinyin fallback for AD members
        if (
          adMemberResults.length === 0 &&
          /^[a-zA-Z0-9]+$/.test(trimmed)
        ) {
          try {
            const { data: fbData } = await searchADMembers({
              keyword: "",
              pagination: { pageNumber: 1, showNumber: 200 },
            });
            const allMembers = (fbData.members || []).map(
              (m: ADDepartmentMemberInfo) => {
                const url = (m.faceURL || m.avatar || "").trim();
                return {
                  userID: m.userID || m.username,
                  nickname: m.nickname || m.displayName || m.username,
                  faceURL:
                    url && url !== "null" && url !== "undefined"
                      ? url
                      : "",
                  displayName: m.displayName || "",
                  position: (m.position || "").trim(),
                  email: m.email || "",
                  departmentName:
                    (m.departmentName || "").trim() ||
                    parseDeptDN(m.departmentID || ""),
                };
              },
            );
            adMemberResults = filterByFuzzyPinyin(allMembers, trimmed);
          } catch {}
        }

        if (!cancelledRef.current) {
          setResults({
            contacts: contactResults.slice(0, sliceLimit),
            agents: agentResults.slice(0, sliceLimit),
            adMembers: adMemberResults.slice(0, sliceLimit),
            groups: groupResults.slice(0, sliceLimit),
            chatHistory: chatHistoryResults.slice(0, sliceLimit),
            totalContacts: contactResults.length,
            totalAgents: agentResults.length,
            totalADMembers: adMemberResults.length,
            totalGroups: groupResults.length,
            totalChatHistory: chatHistoryResults.length,
          });
          setLoading(false);
        }
      })();
    }, 200);

    return () => {
      clearTimeout(timer);
      cancelledRef.current = true;
    };
  }, [keyword, friendList, groupList, conversationList, activeTab]);

  const handleContactClick = (item: FriendUserItem) => {
    closeOverlay();
    toSpecifiedConversation({
      sourceID: item.userID,
      sessionType: SessionType.Single,
    });
  };

  const handleGroupClick = (item: GroupItem) => {
    closeOverlay();
    toSpecifiedConversation({
      sourceID: item.groupID,
      sessionType: SessionType.Group,
    });
  };

  const handleChatClick = (item: ChatHistoryItem) => {
    closeOverlay();
    const sourceID =
      item.conversationType === SessionType.Single
        ? item.userID!
        : item.groupID!;
    toSpecifiedConversation({
      sourceID: sourceID || "",
      sessionType: item.conversationType,
    });
  };

  const handleAgentClick = (item: AgentSearchResult) => {
    closeOverlay();
    toSpecifiedConversation({
      sourceID: item.userID,
      sessionType: SessionType.Single,
    });
  };

  const handleADMemberClick = (item: ADMemberSearchResult) => {
    closeOverlay();
    toSpecifiedConversation({
      sourceID: item.userID,
      sessionType: SessionType.Single,
    });
  };

  const hasAnyResults =
    results.contacts.length > 0 ||
    results.agents.length > 0 ||
    results.adMembers.length > 0 ||
    results.groups.length > 0 ||
    results.chatHistory.length > 0;

  const switchTab = (tab: SearchTab) => {
    setActiveTab(tab);
  };

  const renderContactItem = (item: FriendUserItem) => (
    <div
      key={item.userID}
      className="flex cursor-pointer items-center rounded-md px-2 py-2.5 hover:bg-[var(--primary-active)]"
      onClick={() => handleContactClick(item)}
    >
      <OIMAvatar
        src={item.faceURL}
        text={(item.nickname || item.userID)?.slice(0, 1)}
        size={36}
      />
      <div className="ml-3 flex-1 overflow-hidden">
        <div className="truncate text-sm">
          {item.nickname || item.userID}
        </div>
      </div>
    </div>
  );

  const renderGroupItem = (item: GroupItem) => (
    <div
      key={item.groupID}
      className="flex cursor-pointer items-center rounded-md px-2 py-2.5 hover:bg-[var(--primary-active)]"
      onClick={() => handleGroupClick(item)}
    >
      <OIMAvatar
        src={item.faceURL}
        text={(item.groupName || item.groupID)?.slice(0, 1)}
        size={36}
        isgroup
      />
      <div className="ml-3 flex-1 overflow-hidden">
        <div className="truncate text-sm">
          {item.groupName || item.groupID}
        </div>
      </div>
    </div>
  );

  const renderChatItem = (item: ChatHistoryItem) => {
    const messageAbstract = item.latestMatchMessage
      ? item.latestMatchMessage.textElem?.content ||
        item.latestMatchMessage.content
      : "";

    return (
      <div
        key={item.conversationID}
        className="flex cursor-pointer items-center rounded-md px-2 py-2.5 hover:bg-[var(--primary-active)]"
        onClick={() => handleChatClick(item)}
      >
        <OIMAvatar
          src={item.faceURL}
          text={item.showName?.slice(0, 1)}
          size={36}
          isgroup={item.conversationType === SessionType.Group}
        />
        <div className="ml-3 flex-1 overflow-hidden">
          <div className="truncate text-sm">{item.showName}</div>
          {messageAbstract && (
            <div className="truncate text-xs text-[var(--sub-text)]">
              {messageAbstract}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAgentItem = (item: AgentSearchResult) => (
    <div
      key={item.userID}
      className="flex cursor-pointer items-center rounded-md px-2 py-2.5 hover:bg-[var(--primary-active)]"
      onClick={() => handleAgentClick(item)}
    >
      <Avatar size={36} src={item.faceURL || undefined}>
        {(item.nickname || item.userID).slice(0, 1).toUpperCase()}
      </Avatar>
      <div className="ml-3 flex-1 overflow-hidden">
        <div className="truncate text-sm font-medium">{item.nickname}</div>
        <div className="truncate text-xs text-[#7c3aed]">智能体</div>
      </div>
    </div>
  );

  const renderADMemberItem = (item: ADMemberSearchResult) => (
    <div
      key={item.userID}
      className="flex cursor-pointer items-center rounded-md px-2 py-2.5 hover:bg-[var(--primary-active)]"
      onClick={() => handleADMemberClick(item)}
    >
      <Avatar size={36} src={item.faceURL || undefined}>
        {(item.nickname || item.userID).slice(0, 1).toUpperCase()}
      </Avatar>
      <div className="ml-3 flex-1 overflow-hidden">
        <div className="truncate text-sm font-medium">{item.nickname}</div>
        {[item.departmentName, item.displayName, item.position]
          .filter(Boolean)
          .length > 0 && (
          <div className="truncate text-xs text-[var(--sub-text)]">
            {[item.departmentName, item.displayName, item.position]
              .filter(Boolean)
              .join(" - ")}
          </div>
        )}
      </div>
    </div>
  );

  const renderSection = (
    title: string,
    items: React.ReactNode[],
    showMore?: () => void,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--primary-text)]">
            {title}
          </span>
          {showMore && (
            <span
              className="cursor-pointer text-xs text-[var(--primary)]"
              onClick={showMore}
            >
              {t("placeholder.viewMore")}
            </span>
          )}
        </div>
        <div>{items}</div>
      </div>
    );
  };

  const renderOverview = () => {
    if (!hasAnyResults) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }

    const contactItems = results.contacts.map(renderContactItem);
    const agentItems = results.agents.map(renderAgentItem);
    const adMemberItems = results.adMembers.map(renderADMemberItem);
    const groupItems = results.groups.map(renderGroupItem);
    const chatItems = results.chatHistory.map(renderChatItem);

    return (
      <>
        {renderSection(
          "搜索人员",
          adMemberItems,
          results.totalADMembers > MAX_OVERVIEW_ITEMS
            ? () => switchTab("adMembers")
            : undefined,
        )}
        {renderSection(
          "搜索智能体",
          agentItems,
          results.totalAgents > MAX_OVERVIEW_ITEMS
            ? () => switchTab("agents")
            : undefined,
        )}
        {renderSection(
          t("placeholder.contacts"),
          contactItems,
          results.totalContacts > MAX_OVERVIEW_ITEMS
            ? () => switchTab("contacts")
            : undefined,
        )}
        {renderSection(
          t("placeholder.myGroup"),
          groupItems,
          results.totalGroups > MAX_OVERVIEW_ITEMS
            ? () => switchTab("groups")
            : undefined,
        )}
        {renderSection(
          t("placeholder.messageHistory"),
          chatItems,
          results.totalChatHistory > MAX_OVERVIEW_ITEMS
            ? () => switchTab("chatHistory")
            : undefined,
        )}
      </>
    );
  };

  const renderContacts = () => {
    if (results.contacts.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }
    return <div>{results.contacts.map(renderContactItem)}</div>;
  };

  const renderGroups = () => {
    if (results.groups.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }
    return <div>{results.groups.map(renderGroupItem)}</div>;
  };

  const renderChatHistory = () => {
    if (results.chatHistory.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }
    return <div>{results.chatHistory.map(renderChatItem)}</div>;
  };

  const renderAgents = () => {
    if (results.agents.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }
    return <div>{results.agents.map(renderAgentItem)}</div>;
  };

  const renderADMembers = () => {
    if (results.adMembers.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("empty.noSearchResults")}
        />
      );
    }
    return <div>{results.adMembers.map(renderADMemberItem)}</div>;
  };

  const renderDocuments = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂不支持文档查询"
    />
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "contacts":
        return renderContacts();
      case "agents":
        return renderAgents();
      case "adMembers":
        return renderADMembers();
      case "groups":
        return renderGroups();
      case "chatHistory":
        return renderChatHistory();
      case "documents":
        return renderDocuments();
      default:
        return null;
    }
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={520}
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={() => {
        setKeyword("");
        setActiveTab("overview");
        setResults({
          contacts: [],
          agents: [],
          adMembers: [],
          groups: [],
          chatHistory: [],
          totalContacts: 0,
          totalAgents: 0,
          totalADMembers: 0,
          totalGroups: 0,
          totalChatHistory: 0,
        });
      }}
      ignoreClasses=".ignore-drag, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div className="flex h-12 items-center justify-between bg-[var(--gap-text)] px-5">
        <div className="text-sm font-medium">{t("placeholder.search")}</div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div
        className="ignore-drag flex flex-col"
        style={{ maxHeight: "70vh" }}
      >
        <div className="border-b border-[var(--gap-text)] px-5 py-3">
          <Input.Search
            ref={inputRef}
            className="no-addon-search"
            placeholder={t("placeholder.pleaseEnter")}
            value={keyword}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => {}}
          />
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as SearchTab)}
          className="global-search-tabs px-5"
          size="small"
        >
          <Tabs.TabPane tab={t("placeholder.overview")} key="overview" />
          <Tabs.TabPane tab="搜索人员" key="adMembers" />
          <Tabs.TabPane tab="搜索智能体" key="agents" />
          <Tabs.TabPane tab={t("placeholder.contacts")} key="contacts" />
          <Tabs.TabPane tab={t("placeholder.myGroup")} key="groups" />
          <Tabs.TabPane
            tab={t("placeholder.messageHistory")}
            key="chatHistory"
          />
          <Tabs.TabPane tab={t("placeholder.document")} key="documents" />
        </Tabs>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {renderContent()}
        </div>
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(GlobalSearchModal));
