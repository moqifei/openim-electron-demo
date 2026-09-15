import { SearchOutlined } from "@ant-design/icons";
import { Empty, Input, InputRef, Spin } from "antd";
import { useEffect, useRef, useState } from "react";

import { type AgentInfo, searchAgents } from "@/api/login";
import { searchADMembers, type SearchADMembersResp } from "@/api/organization";
import { useContactStore } from "@/store/contact";
import { filterByFuzzyPinyin } from "@/utils/pinyin";

import CheckItem, { CheckListItem } from "./CheckItem";

type ForwardSearchListProps = {
  checkClick: (item: CheckListItem) => void;
  isChecked: (item: CheckListItem) => boolean;
};

type ApiResponse<T> = T | { data: T };

const unwrapApiResponse = <T extends object>(
  response: ApiResponse<T> | null,
): T | null => {
  if (!response) return null;
  return "data" in response ? response.data : response;
};

const mapMembers = (
  response: ApiResponse<SearchADMembersResp> | null,
): CheckListItem[] => {
  const body = unwrapApiResponse(response);
  return (body?.members || []).map((member) => ({
    userID: member.userID || member.username,
    nickname: member.nickname || member.displayName || member.username,
    faceURL: member.faceURL || member.avatar || "",
    departmentName: member.departmentName || "",
    position: member.position || "",
  }));
};

const mapAgents = (
  response: { data: { users: AgentInfo[] } } | null,
): CheckListItem[] =>
  (response?.data?.users || []).map((agent) => ({
    userID: agent.userID,
    nickname: agent.nickname || agent.userID,
    faceURL: agent.faceURL || "",
    position: "智能体",
  }));

const ForwardSearchList = ({ checkClick, isChecked }: ForwardSearchListProps) => {
  const inputRef = useRef<InputRef>(null);
  const requestIdRef = useRef(0);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckListItem[]>([]);
  const groupList = useContactStore((state) => state.groupList);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const query = keyword.trim();
    if (!query) {
      requestIdRef.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void Promise.all([
        searchADMembers({
          keyword: query,
          pagination: { pageNumber: 1, showNumber: 100 },
        }).catch(() => null),
        searchAgents(query).catch(() => null),
      ]).then(async ([memberResponse, agentResponse]) => {
        if (requestId !== requestIdRef.current) return;

        let people = filterByFuzzyPinyin(mapMembers(memberResponse), query);
        const groups: CheckListItem[] = filterByFuzzyPinyin(
          groupList.map((group) => ({
            ...group,
            nickname: group.groupName || group.groupID,
          })),
          query,
        );
        let agents = filterByFuzzyPinyin(mapAgents(agentResponse), query);
        const isPinyinSearch = /^[a-zA-Z0-9]+$/.test(query);

        if (isPinyinSearch && (!people.length || !agents.length)) {
          const [fallbackMemberResponse, fallbackAgentResponse] = await Promise.all([
            people.length
              ? Promise.resolve(null)
              : searchADMembers({
                  keyword: "",
                  pagination: { pageNumber: 1, showNumber: 1000 },
                }).catch(() => null),
            agents.length
              ? Promise.resolve(null)
              : searchAgents("", { pageNumber: 1, showNumber: 1000 }).catch(() => null),
          ]);
          if (requestId !== requestIdRef.current) return;

          if (fallbackMemberResponse) {
            people = filterByFuzzyPinyin(mapMembers(fallbackMemberResponse), query);
          }
          if (fallbackAgentResponse) {
            agents = filterByFuzzyPinyin(mapAgents(fallbackAgentResponse), query);
          }
        }

        const seen = new Set<string>();
        const nextResults: CheckListItem[] = [...people, ...groups, ...agents].filter(
          (item: CheckListItem) => {
            const id = item.userID || item.groupID;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          },
        );

        setResults(nextResults);
        setLoading(false);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [groupList, keyword]);

  return (
    <div className="flex h-full flex-col">
      <div className="mx-5.5 mb-2 mt-2">
        <Input
          ref={inputRef}
          prefix={<SearchOutlined />}
          placeholder="搜索人员、群组、智能体"
          value={keyword}
          allowClear
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      <div className="relative flex-1 overflow-y-auto">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Spin />
          </div>
        )}
        {results.map((item) => (
          <CheckItem
            showCheck
            isChecked={isChecked(item)}
            data={item}
            key={item.userID || item.groupID}
            itemClick={checkClick}
          />
        ))}
        {!loading && results.length === 0 && (
          <Empty
            className="mt-[20%]"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={keyword.trim() ? "未找到匹配结果" : ""}
          />
        )}
      </div>
    </div>
  );
};

export default ForwardSearchList;
