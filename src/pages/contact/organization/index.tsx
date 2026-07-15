import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { Empty, Spin, Tree, Button, message, Avatar } from "antd";
import { useRequest } from "ahooks";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getADDepartmentList,
  getADDepartmentMembers,
  searchADMembers,
  syncADOrganization,
  type ADDepartmentInfo,
  type ADDepartmentMemberInfo,
} from "@/api/organization";
import OIMAvatar from "@/components/OIMAvatar";
import { emit } from "@/utils/events";

interface TreeNode {
  key: string;
  title: string;
  children?: TreeNode[];
  department?: ADDepartmentInfo;
}

export const Organization = () => {
  const { t } = useTranslation();
  const [selectedDept, setSelectedDept] = useState<ADDepartmentInfo | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  const {
    data: deptResp,
    loading: deptLoading,
    refresh: refreshDepts,
  } = useRequest(getADDepartmentList, {
    cacheKey: "ad_department_list",
  });

  const { data: memberResp, loading: memberLoading } = useRequest(
    () =>
      getADDepartmentMembers({
        departmentID: selectedDept!.departmentID,
        pagination: { pageNumber: 1, showNumber: 1000 },
      }),
    {
      ready: !!selectedDept,
      refreshDeps: [selectedDept],
    },
  );

  const { data: searchResp, loading: searchLoading } = useRequest(
    () =>
      searchADMembers({
        keyword: searchKeyword,
        pagination: { pageNumber: 1, showNumber: 100 },
      }),
    {
      ready: searchKeyword.length > 0,
      debounceWait: 300,
      refreshDeps: [searchKeyword],
    },
  );

  const { run: runSync, loading: syncLoading } = useRequest(syncADOrganization, {
    manual: true,
    onSuccess: () => {
      message.success("同步成功");
      refreshDepts();
    },
    onError: () => {
      message.error("同步失败");
    },
  });

  const departments = deptResp?.data?.departments ?? [];

  const treeData = useMemo((): TreeNode[] => {
    if (!departments.length) return [];
    const deptMap = new Map<string, ADDepartmentInfo>();
    departments.forEach((d: ADDepartmentInfo) => deptMap.set(d.departmentID, d));

    const buildTree = (parentID: string): TreeNode[] => {
      return departments
        .filter((d: ADDepartmentInfo) => d.parentID === parentID)
        .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) => a.name.localeCompare(b.name, "zh-CN"))
        .map((d: ADDepartmentInfo) => ({
          key: d.departmentID,
          title: d.name,
          department: d,
          children: buildTree(d.departmentID),
        }));
    };

    const roots = departments.filter(
      (d: ADDepartmentInfo) => !d.parentID || !deptMap.has(d.parentID),
    );
    return roots
      .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) => a.name.localeCompare(b.name, "zh-CN"))
      .map((d: ADDepartmentInfo) => ({
        key: d.departmentID,
        title: d.name,
        department: d,
        children: buildTree(d.departmentID),
      }));
  }, [departments]);

  const handleSelect = useCallback(
    (_: React.Key[], { node }: { node: TreeNode }) => {
      setSearchKeyword("");
      if (node.department) {
        setSelectedDept(node.department);
      }
    },
    [],
  );

  const showUserCard = (member: ADDepartmentMemberInfo) => {
    emit("OPEN_USER_CARD", {
      userID: member.userID || member.username,
    });
  };

  const members = searchKeyword
    ? searchResp?.data?.members ?? []
    : memberResp?.data?.members ?? [];

  const isSearching = searchKeyword.length > 0;
  const listTitle = isSearching
    ? `搜索结果 (${searchResp?.data?.total ?? 0})`
    : selectedDept
      ? `${selectedDept.name} (${memberResp?.data?.total ?? 0})`
      : "请选择部门";

  // 自定义树节点图标（紫色风格）
  const iconRender = () => (
    <svg className="h-4 w-4 text-[#7c3aed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-base)]">
      {/* 页头 */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t("placeholder.organization") || "组织结构"}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-quaternary)]">浏览部门和成员</p>
        </div>
        <button
          type="button"
          disabled={syncLoading}
          onClick={runSync}
          className="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-sm transition-all duration-200 hover:border-[#c4b5fd] hover:text-[#7c3aed] hover:shadow-md disabled:opacity-50 dark:hover:border-purple-800"
        >
          <ReloadOutlined className={clsx("transition-transform", syncLoading && "animate-spin")} />
          同步
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Department Tree */}
        <div className="w-60 flex-shrink-0 overflow-y-auto border-r border-[var(--border-color)] p-4">
          {deptLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spin tip="加载中..." />
            </div>
          ) : treeData.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-[var(--text-quaternary)]">暂无部门</span>
              }
            />
          ) : (
            <Tree
              treeData={treeData}
              onSelect={handleSelect}
              selectedKeys={selectedDept ? [selectedDept.departmentID] : []}
              defaultExpandAll
              showIcon
              icon={iconRender()}
              className="[&_.ant-tree-treenode]:rounded-lg [&_.ant-tree-treenode]:px-2 [&_.ant-tree-treenode]:py-1 [&_.ant-tree-treenode-selected]:bg-gradient-to-r [&_.ant-tree-treenode-selected]:from-[#ede9fe] [&_.ant-tree-treenode-selected]:to-[#f5f3ff] [&_.ant-tree-switcher]:text-[#a78bfa]"
            />
          )}
        </div>

        {/* Right: Member List */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-5 pb-2">
            <div className="relative">
              <UserOutlined className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--text-quaternary)]" />
              <input
                type="text"
                placeholder="搜索姓名、用户名..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  if (!e.target.value) setSelectedDept(null);
                }}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] pl-9 pr-4 py-2.5 text-sm outline-none transition-all placeholder:text-[var(--text-quaternary)] focus:border-[#a78bfa] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] focus:ring-0"
              />
            </div>
          </div>

          {/* Title */}
          <div className="px-5 pb-2 text-sm font-medium text-[var(--text-tertiary)]">
            {listTitle}
          </div>

          {/* Member list */}
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {memberLoading || searchLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spin tip="加载中..." />
              </div>
            ) : members.length === 0 ? (
              <Empty
                className="mt-[15%]"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span className="text-[var(--text-quaternary)]">
                    {isSearching ? "未找到匹配人员" : "暂无人员"}
                  </span>
                }
              />
            ) : (
              <div className="space-y-1">
                {members.map((member: ADDepartmentMemberInfo) => (
                  <div
                    key={member.username}
                    className="group flex cursor-pointer items-center rounded-xl px-3 py-2.5 transition-all duration-150 hover:bg-[var(--bg-hover)] active:scale-[0.99]"
                    onClick={() => showUserCard(member)}
                  >
                    <OIMAvatar
                      src={undefined}
                      text={(member.nickname || member.displayName || member.username)?.charAt(0)}
                      size={38}
                      bgColor="#7c3aed"
                      color="#fff"
                    />
                    <div className="ml-3 min-w-0 flex-1 overflow-hidden">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[#7c3aed] transition-colors">
                        {member.nickname || member.displayName || member.username}
                      </div>
                      <div className="truncate text-xs leading-relaxed text-[var(--text-quaternary)]">
                        {member.position || member.email || member.username}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
