import { ApartmentOutlined, RightOutlined, RobotOutlined, SearchOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { useDebounceFn, useLatest } from "ahooks";
import { Breadcrumb, Empty, Input, Spin } from "antd";
import { BreadcrumbItemType } from "antd/es/breadcrumb/Breadcrumb";
import clsx from "clsx";
import i18n, { t } from "i18next";
import {
  FC,
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Virtuoso } from "react-virtuoso";

import { getADDepartmentList, getADDepartmentMembers, searchADMembers } from "@/api/organization";
import { AgentInfo, searchAgents } from "@/api/login";
import { filterByFuzzyPinyin } from "@/utils/pinyin";
import group from "@/assets/images/chooseModal/group.png";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import useGroupMembers from "@/hooks/useGroupMembers";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/common";

import CheckItem, { CheckListItem } from "./CheckItem";
import MenuItem from "./MenuItem";

const menuList = [
  {
    idx: 0,
    title: t("placeholder.enterpriseMember") || "企业成员",
    icon: <ApartmentOutlined className="text-xl text-[#ff4d4f]" />,
  },
  {
    idx: 1,
    title: t("placeholder.myGroup"),
    icon: group,
  },
  {
    idx: 2,
    title: t("placeholder.searchAgents"),
    icon: <RobotOutlined className="text-xl text-[var(--primary)]" />,
  },
];

i18n.on("languageChanged", () => {
  menuList[0].title = t("placeholder.enterpriseMember") || "企业成员";
  menuList[1].title = t("placeholder.myGroup");
  menuList[2].title = t("placeholder.searchAgents");
});

export type ChooseMenuItem = (typeof menuList)[0];

interface IChooseBoxProps {
  className?: string;
  isCheckInGroup?: boolean;
  showGroupMember?: boolean;
  chooseOneOnly?: boolean;
  checkMemberRole?: boolean;
}

export interface ChooseBoxHandle {
  getCheckedList: () => CheckListItem[];
  updatePrevCheckList: (data: CheckListItem[]) => void;
  resetState: () => void;
}

const ChooseBox: ForwardRefRenderFunction<ChooseBoxHandle, IChooseBoxProps> = (
  props,
  ref,
) => {
  const { className, isCheckInGroup, showGroupMember, chooseOneOnly, checkMemberRole } =
    props;

  const [checkedList, setCheckedList] = useState<CheckListItem[]>([]);
  const latestCheckedList = useLatest(checkedList);

  const checkClick = useCallback(
    (data: CheckListItem) => {
      const idx = latestCheckedList.current.findIndex(
        (item) =>
          (item.userID && item.userID === data.userID) ||
          (item.groupID && item.groupID === data.groupID && !showGroupMember),
      );
      if (idx > -1) {
        setCheckedList((state) => {
          const newState = [...state];
          newState.splice(idx, 1);
          return newState;
        });
      } else {
        if (chooseOneOnly && latestCheckedList.current.length > 0) {
          feedbackToast({
            msg: t("toast.beyondSelectionLimit"),
            error: t("toast.beyondSelectionLimit"),
          });
          return;
        }

        setCheckedList((state) => [...state, data]);
      }
    },
    [chooseOneOnly],
  );

  const isChecked = useCallback(
    (data: CheckListItem) =>
      checkedList.some(
        (item) =>
          (item.userID && item.userID === data.userID) ||
          (item.groupID && item.groupID === data.groupID && !showGroupMember),
      ),
    [checkedList.length, showGroupMember],
  );

  const resetState = () => {
    setCheckedList([]);
  };

  const updatePrevCheckList = (data: CheckListItem[]) => {
    setCheckedList([...data]);
  };

  useImperativeHandle(ref, () => ({
    getCheckedList: () => checkedList,
    resetState,
    updatePrevCheckList,
  }));

  return (
    <div
      className={clsx(
        "mx-9 mt-5 flex h-[480px] rounded-md border border-[var(--gap-text)]",
        className,
      )}
    >
      <div className="flex flex-1 flex-col border-r border-[var(--gap-text)]">
        <div className="py-3 pb-3" />

        {showGroupMember ? (
          <ForwardMemberList
            isChecked={isChecked}
            checkClick={checkClick}
            checkMemberRole={checkMemberRole}
          />
        ) : (
          <ForwardCommonLeft
            isCheckInGroup={isCheckInGroup!}
            isChecked={isChecked}
            checkClick={checkClick}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-5 py-5.5">
          {t("placeholder.selected")}
          <span className="text-[var(--primary)]">{` ${checkedList.length} `}</span>
        </div>
        <div className="mb-3 flex-1 overflow-y-auto">
          {checkedList.map((item) => (
            <CheckItem
              data={item}
              key={item.userID || item.groupID}
              cancelClick={checkClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(forwardRef(ChooseBox));

interface ICommonLeftProps {
  isCheckInGroup: boolean;
  checkClick: (data: CheckListItem) => void;
  isChecked: (data: CheckListItem) => boolean;
}

const CommonLeft: FC<ICommonLeftProps> = ({
  isCheckInGroup,
  checkClick,
  isChecked,
}) => {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItemType[]>([]);
  const [checkList, setCheckList] = useState<CheckListItem[]>([]);
  const [adMode, setAdMode] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [adDepartments, setAdDepartments] = useState<ADDepartment[]>([]);
  const [adAllDepartments, setAdAllDepartments] = useState<ADDepartment[]>([]);
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  const [currentDeptId, setCurrentDeptId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [adLoading, setAdLoading] = useState(false);
  // Navigation history: [{ deptId, deptName }, ...]
  const [deptHistory, setDeptHistory] = useState<{ deptId: string; deptName: string }[]>([]);

  const resolveFaceURL = (m: ADMember): string => {
    const url = (m.faceURL || m.avatar || "").trim();
    // Reject common invalid values that cause broken image
    if (!url || url === "null" || url === "undefined") {
      console.log("[resolveFaceURL] empty/invalid, userID:", m.userID, "faceURL:", m.faceURL, "avatar:", m.avatar);
      return "";
    }
    console.log("[resolveFaceURL] valid url:", url, "userID:", m.userID);
    return url;
  };

  const resolveDeptName = (m: ADMember): string => {
    // 1. Use departmentName if present
    const directName = (m.departmentName || "").trim();
    if (directName) {
      console.log("[resolveDeptName] from departmentName:", directName, "userID:", m.userID);
      return directName;
    }
    // 2. Try deptMap by departmentID
    const fromMap = deptMap[m.departmentID];
    if (fromMap) {
      console.log("[resolveDeptName] from deptMap:", fromMap, "departmentID:", m.departmentID, "userID:", m.userID);
      return fromMap;
    }
    // 3. Parse DN string: "ou=运维部,ou=中信百信银行,dc=qa,dc=bx" → "运维部"
    const parsed = parseDeptDN(m.departmentID);
    console.log("[resolveDeptName] parsed from DN:", parsed, "raw departmentID:", m.departmentID, "userID:", m.userID);
    return parsed;
  };

  /** Parse LDAP DN string to extract first ou= value as department name */
  const parseDeptDN = (dn: string): string => {
    if (!dn) return "";
    const parts = dn.split(",");
    // Find all ou= values, take the first (deepest) one
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.toLowerCase().startsWith("ou=")) {
        return trimmed.substring(3);
      }
    }
    return "";
  };

  const checkInGroup = async (list: CheckListItem[]) => {
    const currentGroupID = useConversationStore.getState().currentConversation?.groupID;
    console.log("[checkInGroup] isCheckInGroup:", isCheckInGroup, "currentGroupID:", currentGroupID, "list.length:", list.length);
    if (!isCheckInGroup || !currentGroupID) {
      console.log("[checkInGroup] early return, list:", JSON.stringify(list));
      return list;
    }
    const tmpList = JSON.parse(JSON.stringify(list)) as CheckListItem[];
    const userIDList = tmpList
      .filter((item) => Boolean(item.userID))
      .map((item) => item.userID!);
    try {
      const { data } = await IMSDK.getUsersInGroup({
        groupID: currentGroupID,
        userIDList,
      });
      tmpList.map((item) => {
        item.disabled = data.includes(item.userID!);
      });
    } catch (error) {
      console.error(error);
    }
    return tmpList;
  };

  const buildDeptMap = (depts: ADDepartment[]): Record<string, string> => {
    const map: Record<string, string> = {};
    const walk = (list: ADDepartment[]) => {
      for (const d of list) {
        map[d.departmentID] = d.name;
        if (d.subDepartments && d.subDepartments.length > 0) {
          walk(d.subDepartments);
        }
      }
    };
    walk(depts);
    console.log("[buildDeptMap] deptMap keys:", Object.keys(map).slice(0, 10), "total:", Object.keys(map).length);
    return map;
  };

  const loadADDepartments = async () => {
    setAdLoading(true);
    try {
      const resp = await getADDepartmentList();
      const body = (resp && (resp as any).data) ? (resp as any).data : resp;
      const depts = (body?.departments || []) as ADDepartment[];
      setAdAllDepartments(depts);
      setAdDepartments(depts.filter((d: ADDepartment) => d.level === 0));
      setDeptMap(buildDeptMap(depts));
    } catch (error) {
      feedbackToast({ error });
    } finally {
      setAdLoading(false);
    }
  };

  const loadADMembers = async (deptId: string) => {
    console.log("[loadADMembers] called with deptId:", deptId);
    setAdLoading(true);
    try {
      const resp = await getADDepartmentMembers({
        departmentID: deptId,
        pagination: { pageNumber: 1, showNumber: 1000 },
      });
      const body = (resp && (resp as any).data) ? (resp as any).data : resp;
      console.log("[loadADMembers] response total:", body?.total, "members count:", body?.members?.length, "first:", JSON.stringify(body?.members?.[0]));
      const members = (body?.members || []).map((m: ADMember) => ({
        userID: m.userID || m.username,
        nickname: m.nickname || m.displayName || m.username,
        faceURL: resolveFaceURL(m),
        departmentName: resolveDeptName(m),
        position: (m.position || "").trim(),
      }));
      console.log("[loadADMembers] mapped members count:", members.length, "first:", JSON.stringify(members[0]));
      setCheckList(await checkInGroup(members));
    } catch (error) {
      feedbackToast({ error });
    } finally {
      setAdLoading(false);
    }
  };

  const searchAD = useCallback(
    async (keyword: string) => {
      const trimmed = keyword.trim();
      console.log("[searchAD] called, keyword:", JSON.stringify(trimmed), "currentDeptId:", currentDeptId);
      if (!trimmed) {
        console.log("[searchAD] empty keyword, clearing search");
        if (currentDeptId) {
          await loadADMembers(currentDeptId);
        } else {
          await loadADDepartments();
        }
        return;
      }
      setAdLoading(true);
      try {
        console.log("[searchAD] calling searchADMembers with keyword:", trimmed);
        let resp = await searchADMembers({
          keyword: trimmed,
          pagination: { pageNumber: 1, showNumber: 1000 },
        });
        let body = (resp && (resp as any).data) ? (resp as any).data : resp;
        console.log("[searchAD] primary response:", JSON.stringify({ total: body?.total, memberCount: body?.members?.length }));
        let members = (body?.members || []).map((m: ADMember) => ({
          userID: m.userID || m.username,
          nickname: m.nickname || m.displayName || m.username,
          faceURL: resolveFaceURL(m),
          departmentName: resolveDeptName(m),
          position: (m.position || "").trim(),
        }));
        console.log("[searchAD] mapped members count:", members.length, "first:", JSON.stringify(members[0]));

        let filtered = filterByFuzzyPinyin(members, trimmed);
        console.log("[searchAD] after filterByFuzzyPinyin, filtered count:", filtered.length);

        // Fallback: if no results and keyword looks like pinyin/ascii, fetch all and filter client-side
        if (filtered.length === 0 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
          console.log("[searchAD] entering pinyin fallback, fetching all members");
          resp = await searchADMembers({
            keyword: "",
            pagination: { pageNumber: 1, showNumber: 1000 },
          });
          body = (resp && (resp as any).data) ? (resp as any).data : resp;
          console.log("[searchAD] fallback response:", JSON.stringify({ total: body?.total, memberCount: body?.members?.length }));
          members = (body?.members || []).map((m: ADMember) => ({
            userID: m.userID || m.username,
            nickname: m.nickname || m.displayName || m.username,
            faceURL: resolveFaceURL(m),
            departmentName: resolveDeptName(m),
            position: (m.position || "").trim(),
          }));
          console.log("[searchAD] fallback mapped members count:", members.length, "first:", JSON.stringify(members[0]));
          filtered = filterByFuzzyPinyin(members, trimmed);
          console.log("[searchAD] fallback after filterByFuzzyPinyin, filtered count:", filtered.length);
        }

        const checked = await checkInGroup(filtered);
        console.log("[searchAD] final checkList count:", checked.length, "first item:", JSON.stringify(checked[0]));
        setCheckList(checked);
      } catch (error) {
        console.error("[searchAD] error:", error);
        feedbackToast({ error });
      } finally {
        setAdLoading(false);
      }
    },
    [currentDeptId, isCheckInGroup, deptMap],
  );

  const { run: runSearchAD } = useDebounceFn(searchAD, { wait: 300 });

  const breadcrumbClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    setBreadcrumb([]);
    setDeptHistory([]);
    setAdMode(false);
    setAgentMode(false);
    setCurrentDeptId("");
    setSearchKeyword("");
  };

  const onDeptClick = async (dept: ADDepartment) => {
    const hasSubDepts = dept.subDepartmentCount > 0;
    setCurrentDeptId(dept.departmentID);

    // Build breadcrumb: replace or append based on whether switching siblings
    setBreadcrumb((state) => {
      const last = state[state.length - 1];
      const currentFull = adAllDepartments.find((d) => d.departmentID === dept.departmentID);
      const lastDept = last
        ? adAllDepartments.find(
            (d) => d.name === (typeof last.title === "string" ? last.title : ""),
          )
        : undefined;
      if (
        last &&
        lastDept &&
        currentFull &&
        lastDept.parentID === currentFull.parentID
      ) {
        return [
          ...state.slice(0, -1),
          { title: dept.name, className: "text-xs text-[var(--primary)]" },
        ];
      }
      return [
        ...state,
        { title: dept.name, className: "text-xs text-[var(--primary)]" },
      ];
    });

    // Update navigation history
    setDeptHistory((prev) => {
      const last = prev[prev.length - 1];
      const currentFull = adAllDepartments.find((d) => d.departmentID === dept.departmentID);
      const lastDeptInHist = last
        ? adAllDepartments.find((d) => d.departmentID === last.deptId)
        : undefined;
      if (last && currentFull && lastDeptInHist && lastDeptInHist.parentID === currentFull.parentID) {
        return [...prev.slice(0, -1), { deptId: dept.departmentID, deptName: dept.name }];
      }
      return [...prev, { deptId: dept.departmentID, deptName: dept.name }];
    });

    setAdLoading(true);
    try {
      if (hasSubDepts) {
        setAdDepartments(
          adAllDepartments.filter((d) => d.parentID === dept.departmentID),
        );
      } else {
        setAdDepartments([]);
      }

      const memberRes = await getADDepartmentMembers({
        departmentID: dept.departmentID,
        pagination: { pageNumber: 1, showNumber: 1000 },
      });
      const memberBody =
        (memberRes && (memberRes as any).data)
          ? (memberRes as any).data
          : memberRes;
      const members = (memberBody?.members || []).map((m: ADMember) => ({
        userID: m.userID || m.username,
        nickname: m.nickname || m.displayName || m.username,
        faceURL: resolveFaceURL(m),
        departmentName: resolveDeptName(m),
        position: (m.position || "").trim(),
      }));
      if (members.length > 0) {
        setCheckList(await checkInGroup(members));
      } else {
        setCheckList([]);
      }
    } catch (error) {
      feedbackToast({ error });
    }
    setAdLoading(false);
  };

  // Navigate back to a breadcrumb level
  const navigateToBreadcrumbIndex = async (index: number) => {
    // index 0 = "企业成员" (root), index 1+ = deptHistory[index-1]
    if (index === 0) {
      setBreadcrumb(breadcrumb.slice(0, 1));
      setDeptHistory([]);
      setCurrentDeptId("");
      setAdDepartments(adAllDepartments.filter((d) => d.level === 0));
      setCheckList([]);
      return;
    }
    const target = deptHistory[index - 1];
    if (!target) return;
    setBreadcrumb(breadcrumb.slice(0, index + 1));
    setDeptHistory(deptHistory.slice(0, index));
    setCurrentDeptId(target.deptId);

    setAdLoading(true);
    try {
      const targetDept = adAllDepartments.find((d) => d.departmentID === target.deptId);
      if (targetDept && targetDept.subDepartmentCount > 0) {
        setAdDepartments(
          adAllDepartments.filter((d) => d.parentID === target.deptId),
        );
      } else {
        setAdDepartments([]);
      }
      const memberRes = await getADDepartmentMembers({
        departmentID: target.deptId,
        pagination: { pageNumber: 1, showNumber: 1000 },
      });
      const memberBody =
        (memberRes && (memberRes as any).data)
          ? (memberRes as any).data
          : memberRes;
      const members = (memberBody?.members || []).map((m: ADMember) => ({
        userID: m.userID || m.username,
        nickname: m.nickname || m.displayName || m.username,
        faceURL: resolveFaceURL(m),
        departmentName: resolveDeptName(m),
        position: (m.position || "").trim(),
      }));
      if (members.length > 0) {
        setCheckList(await checkInGroup(members));
      } else {
        setCheckList([]);
      }
    } catch (error) {
      feedbackToast({ error });
    }
    setAdLoading(false);
  };

  const menuClick = useCallback(
    async (idx: number) => {
      const pushItem: BreadcrumbItemType = {
        title: "",
        className: "text-xs text-[var(--primary)]",
        onClick: () => {},
      };
      switch (idx) {
        case 0:
          setAdMode(true);
          setCurrentDeptId("");
          setSearchKeyword("");
          setCheckList([]);
          setDeptHistory([]);
          await loadADDepartments();
          pushItem.title = t("placeholder.enterpriseMember") || "企业成员";
          pushItem.onClick = () => {
            setBreadcrumb([pushItem]);
            setDeptHistory([]);
            setCurrentDeptId("");
            setAdDepartments(adAllDepartments.filter((d) => d.level === 0));
            setCheckList([]);
          };
          break;
        case 1:
          setAdMode(false);
          setAgentMode(false);
          setCurrentDeptId("");
          setSearchKeyword("");
          setAdDepartments([]);
          setDeptHistory([]);
          setCheckList(await checkInGroup(useContactStore.getState().groupList));
          pushItem.title = t("placeholder.myGroup");
          break;
        case 2:
          setAdMode(false);
          setAgentMode(true);
          setCurrentDeptId("");
          setSearchKeyword("");
          setAdDepartments([]);
          setDeptHistory([]);
          pushItem.title = t("placeholder.searchAgents");
          // Load agents immediately
          setAdLoading(true);
          try {
            const { data } = await searchAgents("");
            const agents = (data.users || []).filter(
              (a: AgentInfo) => a.registerType !== 3,
            );
            setCheckList(
              await checkInGroup(
                agents.map((a: AgentInfo) => ({
                  userID: a.userID,
                  nickname: a.nickname || a.userID,
                  faceURL: a.faceURL || "",
                })),
              ),
            );
          } catch (error) {
            feedbackToast({ error });
          }
          setAdLoading(false);
          break;
        default:
          break;
      }
      setBreadcrumb((state) => (state.length === 0 ? [...state, pushItem] : state));
    },
    [checkInGroup],
  );

  if (breadcrumb.length < 1) {
    return (
      <div className="flex-1 overflow-auto">
        {menuList.map((menu) => (
          <MenuItem menu={menu} key={menu.idx} menuClick={menuClick} />
        ))}
      </div>
    );
  }

  const showSearch = adMode;
  const showDeptList = adMode && adDepartments.length > 0 && !searchKeyword.trim();

  console.log(
    "[ChooseBox render] adMode:",
    adMode,
    "showDeptList:",
    showDeptList,
    "checkList.length:",
    checkList.length,
    "adDepartments.length:",
    adDepartments.length,
    "searchKeyword:",
    searchKeyword,
    "adLoading:",
    adLoading,
  );

  return (
    <div className="flex flex-1 flex-col">
      <Breadcrumb
        className="mx-5.5"
        separator=">"
        items={[
          {
            title: t("placeholder.contacts"),
            href: "",
            className: "text-xs text-[var(--sub-text)]",
            onClick: breadcrumbClick,
          },
          ...breadcrumb.map((item, idx) => ({
            key: `bc-${idx}`,
            title: item.title,
            className: `${item.className || "text-xs text-[var(--primary)]"} cursor-pointer`,
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigateToBreadcrumbIndex(idx);
            },
          })),
        ]}
      />
      {showSearch && (
        <div className="mx-5.5 mb-2 mt-2">
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("placeholder.search") || "搜索"}
            value={searchKeyword}
            onChange={(e) => {
              const val = e.target.value;
              setSearchKeyword(val);
              runSearchAD(val);
            }}
            allowClear
          />
        </div>
      )}
      <div className="relative mb-3 flex-1 min-h-0 overflow-y-auto">
        {adLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Spin />
          </div>
        )}
        {showDeptList && (
          <div>
            <div className="mx-3.5 mb-1 text-xs text-[var(--sub-text)]">部门</div>
            {adDepartments.map((dept) => (
              <div
                key={dept.departmentID}
                className="mx-2 flex cursor-pointer items-center justify-between rounded-md px-3.5 py-2.5 hover:bg-[var(--primary-active)]"
                onClick={() => onDeptClick(dept)}
              >
                <div className="flex items-center">
                  <ApartmentOutlined className="mr-3 text-lg text-[var(--primary)]" />
                  <div className="truncate">{dept.name}</div>
                  {dept.memberCount > 0 && (
                    <span className="ml-2 text-xs text-[var(--sub-text)]">
                      ({dept.memberCount})
                    </span>
                  )}
                </div>
                <RightOutlined className="text-[var(--sub-text)]" rev={undefined} />
              </div>
            ))}
          </div>
        )}
        {checkList.length > 0 && (
          <div className={showDeptList ? "max-h-[50%]" : "h-full"}>
            {showDeptList && <div className="mx-3.5 mb-1 mt-3 text-xs text-[var(--sub-text)]">人员</div>}
            <Virtuoso
              className="h-full"
              data={checkList}
              itemContent={(_, item) => (
                <CheckItem
                  showCheck
                  isChecked={isChecked(item)}
                  data={item}
                  key={item.userID || item.groupID}
                  itemClick={checkClick}
                />
              )}
            />
          </div>
        )}
        {!showDeptList && checkList.length === 0 && (
          <Empty
            className="mt-[20%]"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchKeyword.trim()
                ? "未找到匹配人员"
                : currentDeptId
                  ? "暂无人员"
                  : ""
            }
          />
        )}
      </div>
    </div>
  );
};

const ForwardCommonLeft = memo(CommonLeft);

interface IGroupMemberListProps {
  checkMemberRole?: boolean;
  checkClick: (data: CheckListItem) => void;
  isChecked: (data: CheckListItem) => boolean;
}

const GroupMemberList: FC<IGroupMemberListProps> = ({
  checkMemberRole,
  checkClick,
  isChecked,
}) => {
  const { currentRolevel, currentMemberInGroup } = useCurrentMemberRole();
  const { fetchState, getMemberData, resetState } = useGroupMembers();

  useEffect(() => {
    if (currentMemberInGroup?.groupID) {
      getMemberData(true);
    }
    return () => {
      resetState();
    };
  }, [currentMemberInGroup?.groupID]);

  const endReached = () => {
    if (fetchState.loading || !fetchState.hasMore) {
      return;
    }
    getMemberData();
  };

  const isDisabled = (member: GroupMemberItem) => {
    if (member.userID === currentMemberInGroup?.userID) return true;
    if (!checkMemberRole) return false;
    return member.roleLevel >= currentRolevel;
  };

  return (
    <Spin wrapperClassName="h-full" spinning={fetchState.loading}>
      <Virtuoso
        className="h-full overflow-x-hidden"
        data={fetchState.groupMemberList}
        fixedItemHeight={62}
        endReached={endReached}
        itemContent={(_, member) => (
          <CheckItem
            showCheck
            isChecked={isChecked(member)}
            disabled={isDisabled(member)}
            data={member}
            itemClick={checkClick}
          />
        )}
      />
    </Spin>
  );
};

const ForwardMemberList = memo(GroupMemberList);

// ────────── AD Organization helpers ──────────

interface ADDepartment {
  departmentID: string;
  name: string;
  parentID: string;
  level: number;
  memberCount: number;
  subDepartmentCount: number;
  subDepartments?: ADDepartment[];
}

interface ADMember {
  userID: string;
  username: string;
  nickname: string;
  displayName: string;
  email: string;
  departmentID: string;
  position: string;
  phone: string;
  avatar?: string;
  faceURL?: string;
  departmentName?: string;
}
