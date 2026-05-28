import { ApartmentOutlined, ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { Empty, Spin, Tree, Button, message, Avatar } from "antd";
import { useRequest } from "ahooks";
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

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="m-5.5 mb-2 flex items-center justify-between text-base font-extrabold">
        <span>{t("placeholder.organization") || "组织结构"}</span>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={syncLoading}
          onClick={runSync}
        >
          同步
        </Button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Department Tree */}
        <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-[var(--gap-text)] p-3">
          {deptLoading ? (
            <Spin />
          ) : treeData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无部门" />
          ) : (
            <Tree
              treeData={treeData}
              onSelect={handleSelect}
              selectedKeys={selectedDept ? [selectedDept.departmentID] : []}
              defaultExpandAll
              showIcon
              icon={<ApartmentOutlined className="text-[var(--primary)]" />}
            />
          )}
        </div>

        {/* Right: Member List */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-3 pb-0">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索姓名、用户名..."
                className="w-full rounded-md border border-[var(--gap-text)] bg-[var(--chat-bubble)] px-3 py-2 pl-9 text-sm outline-none focus:border-[var(--primary)]"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  if (!e.target.value) setSelectedDept(null);
                }}
              />
              <UserOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sub-text)]" />
            </div>
          </div>

          {/* Title */}
          <div className="px-3 py-2 text-sm font-medium text-[var(--sub-text)]">
            {listTitle}
          </div>

          {/* Member list */}
          <div className="flex-1 overflow-y-auto px-3">
            {memberLoading || searchLoading ? (
              <Spin className="mt-10 block" />
            ) : members.length === 0 ? (
              <Empty
                className="mt-[20%]"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={isSearching ? "未找到匹配人员" : "暂无人员"}
              />
            ) : (
              <div className="space-y-1">
                {members.map((member: ADDepartmentMemberInfo) => (
                  <div
                    key={member.username}
                    className="flex cursor-pointer items-center rounded-md p-2.5 hover:bg-[var(--primary-active)]"
                    onClick={() => showUserCard(member)}
                  >
                    <Avatar
                      size={40}
                      icon={<UserOutlined />}
                      className="flex-shrink-0 bg-[var(--primary)]"
                    >
                      {(member.nickname || member.displayName || member.username)?.charAt(0)}
                    </Avatar>
                    <div className="ml-3 flex-1 overflow-hidden">
                      <div className="truncate text-sm font-medium">
                        {member.nickname || member.displayName || member.username}
                      </div>
                      <div className="truncate text-xs text-[var(--sub-text)]">
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
