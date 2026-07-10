import { CloseOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { GroupItem, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { Avatar, Button, Empty, Input, InputRef, Spin } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { AgentInfo, searchAgents } from "@/api/login";
import { ADDepartmentMemberInfo, searchADMembers } from "@/api/organization";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useContactStore } from "@/store";
import { isDisplayableAgent } from "@/utils/agentRecommendations";
import { feedbackToast } from "@/utils/common";
import { filterByFuzzyPinyin } from "@/utils/pinyin";

import { IMSDK } from "../MainContentWrap";

interface ISearchUserOrGroupProps {
  isSearchGroup: boolean;
  isSearchAgent?: boolean;
  openGroupCardWithData: (data: GroupItem) => void;
}

interface SearchResultItem {
  userID: string;
  nickname: string;
  faceURL: string;
  displayName: string;
  position: string;
  email: string;
  departmentID: string;
  departmentName: string;
}

const SearchUserOrGroup: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  ISearchUserOrGroupProps
> = ({ isSearchGroup, isSearchAgent, openGroupCardWithData }, ref) => {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);
  const { toSpecifiedConversation } = useConversationToggle();

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus());
    }
  }, [isOverlayOpen]);

  // Refresh all agents (for both auto-load and keyword search)
  const fetchAllAgents = async (kw = ""): Promise<SearchResultItem[]> => {
    const { data } = await searchAgents(kw);
    const users = (data.users || []).filter(isDisplayableAgent);
    return users.map((a: AgentInfo) => ({
      userID: a.userID,
      nickname: a.nickname || a.userID,
      faceURL: a.faceURL || "",
      displayName: "",
      position: "",
      email: "",
      departmentID: "",
      departmentName: "",
    }));
  };

  // Auto-load all agents when opening the agent search modal
  useEffect(() => {
    if (isOverlayOpen && isSearchAgent) {
      setLoading(true);
      setHasSearched(true);
      fetchAllAgents("")
        .then((results) => {
          setSearchResults(results);
          setLoading(false);
        })
        .catch((error) => {
          setLoading(false);
          setSearchResults([]);
          feedbackToast({ error });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayOpen, isSearchAgent]);

  const searchData = async () => {
    setLoading(true);
    setHasSearched(true);

    if (isSearchAgent) {
      try {
        const results = await fetchAllAgents(keyword.trim());
        setSearchResults(results);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        setSearchResults([]);
        feedbackToast({ error });
      }
    } else if (isSearchGroup) {
      if (!keyword || !keyword.trim()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await IMSDK.getSpecifiedGroupsInfo([keyword.trim()]);
        const groupInfo = data[0];
        setLoading(false);
        if (!groupInfo) {
          setSearchResults([]);
          return;
        }
        openGroupCardWithData(groupInfo);
        closeOverlay();
      } catch (error) {
        setLoading(false);
        if ((error as WSEvent).errCode === 1004) {
          setSearchResults([]);
          return;
        }
        feedbackToast({ error });
      }
    } else {
      try {
        const trimmed = keyword.trim();
        console.log(
          "[SearchUserOrGroup] searchData, keyword:",
          JSON.stringify(trimmed),
        );

        let {
          data: { total, members },
        } = await searchADMembers({
          keyword: trimmed,
          pagination: { pageNumber: 1, showNumber: 200 },
        });
        console.log(
          "[SearchUserOrGroup] primary response total:",
          total,
          "members count:",
          members?.length,
          "first:",
          JSON.stringify(members?.[0]),
        );

        // Fallback: if no results and keyword looks like pinyin/ascii, fetch all and filter client-side
        if (
          (!total || !members || members.length === 0) &&
          /^[a-zA-Z0-9]+$/.test(trimmed)
        ) {
          console.log("[SearchUserOrGroup] entering pinyin fallback");
          const resp = await searchADMembers({
            keyword: "",
            pagination: { pageNumber: 1, showNumber: 200 },
          });
          total = resp.data.total;
          members = resp.data.members;
          console.log(
            "[SearchUserOrGroup] fallback response total:",
            total,
            "members count:",
            members?.length,
            "first:",
            JSON.stringify(members?.[0]),
          );
        }

        if (!total || !members || members.length === 0) {
          console.log("[SearchUserOrGroup] no results, clearing");
          setSearchResults([]);
          setLoading(false);
          return;
        }

        // Parse DN string like "ou=运维部,ou=中信百信银行,dc=qa,dc=bx" → "运维部"
        const parseDeptDN = (dn: string): string => {
          if (!dn) return "";
          const parts = dn.split(",");
          for (const part of parts) {
            const t = part.trim();
            if (t.toLowerCase().startsWith("ou=")) return t.substring(3);
          }
          return "";
        };

        // Map to search results
        const rawResults: SearchResultItem[] = members.map(
          (m: ADDepartmentMemberInfo) => {
            const url = (m.faceURL || m.avatar || "").trim();
            const validURL = url && url !== "null" && url !== "undefined" ? url : "";
            const deptName =
              (m.departmentName || "").trim() || parseDeptDN(m.departmentID || "");
            console.log(
              "[SearchUserOrGroup] map member:",
              m.nickname || m.displayName || m.username,
              "faceURL:",
              validURL,
              "deptName:",
              deptName,
              "raw departmentID:",
              m.departmentID,
            );
            return {
              userID: m.userID || m.username,
              nickname: m.nickname || m.displayName || m.username,
              faceURL: validURL,
              displayName: m.displayName || "",
              position: (m.position || "").trim(),
              email: m.email || "",
              departmentID: m.departmentID || "",
              departmentName: deptName,
            };
          },
        );

        // Apply client-side fuzzy + pinyin filtering
        const filtered = filterByFuzzyPinyin(rawResults, trimmed);
        console.log(
          "[SearchUserOrGroup] after filterByFuzzyPinyin, filtered count:",
          filtered.length,
          "first:",
          JSON.stringify(filtered[0]),
        );

        // Enrich with friend info
        const friendList = useContactStore.getState().friendList;
        console.log("[SearchUserOrGroup] friendList count:", friendList.length);
        const enriched = filtered.map((item) => {
          const friend = friendList.find((f) => f.userID === item.userID);
          if (friend) {
            console.log(
              "[SearchUserOrGroup] found friend for:",
              item.userID,
              "friend.faceURL:",
              friend.faceURL,
            );
            item.nickname = friend.nickname || item.nickname;
            item.faceURL = friend.faceURL || item.faceURL;
          }
          return item;
        });

        console.log(
          "[SearchUserOrGroup] final enriched count:",
          enriched.length,
          "first:",
          JSON.stringify(enriched[0]),
        );
        setSearchResults(enriched);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        setSearchResults([]);
        if ((error as WSEvent).errCode === 1004) {
          return;
        }
        feedbackToast({ error });
      }
    }
  };

  const handleUserClick = async (item: SearchResultItem) => {
    closeOverlay();
    await toSpecifiedConversation({
      sourceID: item.userID,
      sessionType: SessionType.Single,
    });
  };

  const showEmpty =
    hasSearched && !loading && searchResults.length === 0 && Boolean(keyword.trim());

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={360}
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={() => {
        setKeyword("");
        setSearchResults([]);
        setHasSearched(false);
      }}
      ignoreClasses=".ignore-drag, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div className="flex h-12 items-center justify-between bg-[var(--gap-text)] px-5.5">
        <div>
          {isSearchAgent
            ? t("placeholder.searchAgents")
            : isSearchGroup
            ? t("placeholder.addGroup")
            : t("placeholder.addFriends")}
        </div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="ignore-drag flex flex-col" style={{ maxHeight: "60vh" }}>
        {/* Search bar */}
        <div className="border-b border-[var(--gap-text)] px-5.5 py-4">
          <Input.Search
            ref={inputRef}
            className="no-addon-search"
            placeholder={t("placeholder.pleaseEnter")}
            value={keyword}
            addonAfter={null}
            spellCheck={false}
            onChange={(e) => {
              const val = e.target.value;
              setKeyword(val);
              if (!val.trim()) {
                setSearchResults([]);
                setHasSearched(false);
              }
            }}
            onSearch={searchData}
            onPressEnter={searchData}
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spin />
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <Empty
            className="mt-10"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("empty.noSearchResults")}
          />
        )}

        {/* Results list */}
        {!loading && searchResults.length > 0 && (
          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-3 pb-1 text-xs text-[var(--sub-text)]">
              {t("placeholder.selected") || "搜索结果"} ({searchResults.length})
            </div>
            {searchResults.map((item) => (
              <div
                key={item.userID}
                className="mx-1 flex cursor-pointer items-center rounded-md px-3 py-2.5 hover:bg-[var(--primary-active)]"
                onClick={() => handleUserClick(item)}
              >
                <Avatar size={36} src={item.faceURL || undefined}>
                  {item.nickname.slice(0, 1).toUpperCase()}
                </Avatar>
                <div className="ml-3 flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium">{item.nickname}</div>
                  {(item.displayName || item.position || item.departmentName) && (
                    <div className="truncate text-xs text-[var(--sub-text)]">
                      {[item.departmentName, item.displayName, item.position]
                        .filter(Boolean)
                        .join(" - ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end border-t border-[var(--gap-text)] px-5.5 py-2.5">
          <Button
            loading={loading}
            className="px-6"
            type="primary"
            disabled={!keyword.trim()}
            onClick={searchData}
          >
            {t("confirm")}
          </Button>
          <Button
            className="ml-3 border-0 bg-[var(--chat-bubble)] px-6"
            onClick={closeOverlay}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(SearchUserOrGroup));
