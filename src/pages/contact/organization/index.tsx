import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { useRequest } from "ahooks";
import { Avatar, Button, Empty, message, Spin, Tree } from "antd";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type ADDepartmentInfo,
  type ADDepartmentMemberInfo,
  getADDepartmentList,
  getADDepartmentMembers,
  searchADMembers,
  syncADOrganization,
} from "@/api/organization";
import OIMAvatar from "@/components/OIMAvatar";
import { emit } from "@/utils/events";

import styles from "./organization.module.scss";
import { getOrganizationNodeClassName } from "./treePresentation";

// Allowed top-level OUs for enterprise organization display.
// Only departments and users under these OUs will be shown in the
// organization tree and search results.
// Order determines display order in the tree (百信行员 first).
const ALLOWED_TOP_OUS = ["ZXBXUsers", "COUsers", "PJUsers"];

/** Enterprise (top-level) display name shown above all OU categories. */
const ENTERPRISE_NAME = "中信百信银行";

/** Human-friendly display names for the top-level OU categories. */
const OU_DISPLAY_NAMES: Record<string, string> = {
  ZXBXUsers: "百信行员",
  COUsers: "百信外包",
  PJUsers: "项目团队",
};

/**
 * ZXBXUsers 下需要置顶显示的部门名称列表（按顺序）。
 * 这些部门会排在其他 ZXBXUsers 部门之前。
 */
const ZXBX_PINNED_DEPTS = ["管理层"];

/** Check whether a departmentID (DN) is under an allowed top-level OU. */
function isAllowedDept(deptID: string): boolean {
  if (!deptID) return false;
  const idLower = deptID.toLowerCase();
  return ALLOWED_TOP_OUS.some((ou) => {
    const pattern = `ou=${ou.toLowerCase()}`;
    // Match ",ou=cousers," (middle of DN) or "ou=cousers," (start of DN)
    return idLower.includes(`,${pattern},`) || idLower.startsWith(`${pattern},`);
  });
}

/** Map a raw department name to its display name (e.g. "ZXBXUsers" → "百信行员"). */
function displayDeptName(name: string): string {
  return OU_DISPLAY_NAMES[name] ?? name;
}

/**
 * Extract the top-level allowed OU name from a department's DN.
 * e.g. "ou=产品创新部,ou=ZXBXUsers,ou=中信百信银行,dc=qa,dc=bx" → "ZXBXUsers"
 * Returns null if no allowed OU is found.
 */
function extractTopOU(deptID: string): string | null {
  if (!deptID) return null;
  const idLower = deptID.toLowerCase();
  for (const ou of ALLOWED_TOP_OUS) {
    const pattern = `ou=${ou.toLowerCase()}`;
    if (idLower.includes(`,${pattern},`) || idLower.startsWith(`${pattern},`)) {
      return ou;
    }
  }
  return null;
}

interface TreeNode {
  key: string;
  title: string;
  children?: TreeNode[];
  department?: ADDepartmentInfo;
  selectable?: boolean;
}

export const Organization = () => {
  const { t } = useTranslation();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDept, setSelectedDept] = useState<ADDepartmentInfo | null>(null);

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
      ready: Boolean(selectedDept),
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

  // Filter to only allowed OUs for both tree and member display.
  const allowedDepts = useMemo(
    () => departments.filter((d: ADDepartmentInfo) => isAllowedDept(d.departmentID)),
    [departments],
  );

  // DEBUG: 在浏览器控制台查看数据流（确认上线后可删除此行）
  console.log(
    "[OrgDebug] totalDepts=",
    departments.length,
    "allowedDepts=",
    allowedDepts.length,
    departments.length > 0 ? `sampleDN=${departments[0].departmentID}` : "",
  );

  const treeData = useMemo((): TreeNode[] => {
    if (!allowedDepts.length) return [];

    // Group real departments by their top-level allowed OU (extracted from DN).
    const ouGroups = new Map<string, ADDepartmentInfo[]>();
    for (const ou of ALLOWED_TOP_OUS) {
      ouGroups.set(ou, []);
    }
    for (const d of allowedDepts) {
      const ou = extractTopOU(d.departmentID);
      if (ou && ouGroups.has(ou)) {
        ouGroups.get(ou)!.push(d);
      }
    }

    // Build the real department sub-tree using parentID.
    const deptMap = new Map<string, ADDepartmentInfo>();
    allowedDepts.forEach((d: ADDepartmentInfo) => deptMap.set(d.departmentID, d));

    const buildSubTree = (parentID: string): TreeNode[] => {
      return allowedDepts
        .filter((d: ADDepartmentInfo) => d.parentID === parentID)
        .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) =>
          a.name.localeCompare(b.name, "zh-CN"),
        )
        .map((d: ADDepartmentInfo) => ({
          key: d.departmentID,
          title: d.name,
          department: d,
          children: buildSubTree(d.departmentID),
        }));
    };

    /**
     * Sort helper for ZXBXUsers root departments:
     * - Pinned departments (ZXBX_PINNED_DEPTS) appear first in order
     * - Remaining departments sorted by name (zh-CN locale)
     */
    const sortZXBXRoots = (
      depts: ADDepartmentInfo[],
    ): ADDepartmentInfo[] => {
      const pinnedSet = new Set(ZXBX_PINNED_DEPTS);
      const pinned: ADDepartmentInfo[] = [];
      const rest: ADDepartmentInfo[] = [];
      for (const d of depts) {
        if (pinnedSet.has(d.name)) {
          pinned.push(d);
        } else {
          rest.push(d);
        }
      }
      // Pinned 保持 ZXBX_PINNED_DEPTS 原始顺序; rest 按名称排序
      rest.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      // 按 pinned 列表顺序排列已匹配的部门
      pinned.sort(
        (a, b) =>
          ZXBX_PINNED_DEPTS.indexOf(a.name) -
          ZXBX_PINNED_DEPTS.indexOf(b.name),
      );
      return [...pinned, ...rest];
    };

    // For each OU group, find root-level departments (those whose parent is not in allowedDepts).
    const buildOUGroupChildren = (ou: string): TreeNode[] => {
      const groupDepts = ouGroups.get(ou) ?? [];
      // Roots within this group: parent not in deptMap or parent is outside allowed OUs
      const roots = groupDepts.filter(
        (d: ADDepartmentInfo) => !d.parentID || !deptMap.has(d.parentID),
      );
      return roots
        .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) =>
          a.name.localeCompare(b.name, "zh-CN"),
        )
        .map((d: ADDepartmentInfo) => ({
          key: d.departmentID,
          title: d.name,
          department: d,
          children: buildSubTree(d.departmentID),
        }));
    };

    // ── ZXBXUsers: 拉平（不展示"百信行员"中间层）──
    const zxbxGroupDepts = ouGroups.get("ZXBXUsers") ?? [];
    const zxbxDeptMap = new Map<string, ADDepartmentInfo>();
    zxbxGroupDepts.forEach((d) => zxbxDeptMap.set(d.departmentID, d));

    const buildZXBXSubTree = (parentID: string): TreeNode[] => {
      return zxbxGroupDepts
        .filter((d: ADDepartmentInfo) => d.parentID === parentID)
        .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) =>
          a.name.localeCompare(b.name, "zh-CN"),
        )
        .map((d: ADDepartmentInfo) => ({
          key: d.departmentID,
          title: d.name,
          department: d,
          children: buildZXBXSubTree(d.departmentID),
        }));
    };
    const zxbxRoots = zxbxGroupDepts.filter(
      (d: ADDepartmentInfo) => !d.parentID || !zxbxDeptMap.has(d.parentID),
    );
    const zxbxNodes: TreeNode[] = sortZXBXRoots(zxbxRoots).map(
      (d: ADDepartmentInfo) => ({
        key: d.departmentID,
        title: d.name,
        department: d,
        children: buildZXBXSubTree(d.departmentID),
      }),
    );

    // ── COUsers + PJUsers 合并为"百信外包"(保留层级) ──
    // COUsers 和 PJUsers 的数据都归入"百信外包"节点下展示
    const coMergedDepts = [
      ...(ouGroups.get("COUsers") ?? []),
      ...(ouGroups.get("PJUsers") ?? []),
    ];
    const coMergedDeptMap = new Map<string, ADDepartmentInfo>();
    coMergedDepts.forEach((d) => coMergedDeptMap.set(d.departmentID, d));

    const buildCOMergedSubTree = (parentID: string): TreeNode[] => {
      return coMergedDepts
        .filter((d: ADDepartmentInfo) => d.parentID === parentID)
        .sort((a: ADDepartmentInfo, b: ADDepartmentInfo) =>
          a.name.localeCompare(b.name, "zh-CN"),
        )
        .map((d: ADDepartmentInfo) => ({
          key: d.departmentID,
          title: d.name,
          department: d,
          children: buildCOMergedSubTree(d.departmentID),
        }));
    };
    const coRoots = coMergedDepts.filter(
      (d: ADDepartmentInfo) => !d.parentID || !coMergedDeptMap.has(d.parentID),
    );
    const coNode: TreeNode | null =
      coRoots.length > 0
        ? {
            key: "__ou_COUsers__",
            title: displayDeptName("COUsers"), // "百信外包"
            selectable: false,
            children: coRoots
              .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
              .map((d: ADDepartmentInfo) => ({
                key: d.departmentID,
                title: d.name,
                department: d,
                children: buildCOMergedSubTree(d.departmentID),
              })),
          }
        : null;

    // Assemble final tree under enterprise root.
    const children: TreeNode[] = [...zxbxNodes];
    if (coNode) children.push(coNode);

    if (children.length === 0) return [];
    return [
      {
        key: "__enterprise__",
        title: ENTERPRISE_NAME,
        selectable: false,
        children,
      },
    ];
  }, [allowedDepts]);

  // 默认只展开根节点（中信百信银行），其余层级用户手动展开
  const defaultExpandedKeys = useMemo(() => ["__enterprise__"], []);

  const [treeWidth, setTreeWidth] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("org_tree_width")) || 320;
    } catch {
      return 320;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleSelect = useCallback((_: React.Key[], { node }: { node: TreeNode }) => {
    setSearchKeyword("");
    if (node.department) {
      setSelectedDept(node.department);
    }
  }, []);

  const showUserCard = (member: ADDepartmentMemberInfo) => {
    emit("OPEN_USER_CARD", {
      userID: member.userID || member.username,
    });
  };

  // ── 拖拽调整树宽度 ──
  const MIN_TREE_WIDTH = 220;
  const MAX_TREE_WIDTH = 600;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = treeWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, startWidth + delta));
        setTreeWidth(newWidth);
        try {
          localStorage.setItem("org_tree_width", String(newWidth));
        } catch {}
      };

      const onMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [treeWidth],
  );

  // Filter members to only show those under allowed OUs.
  const rawMembers = searchKeyword
    ? searchResp?.data?.members ?? []
    : memberResp?.data?.members ?? [];
  const members = useMemo(
    () =>
      rawMembers.filter((m: ADDepartmentMemberInfo) => isAllowedDept(m.departmentID)),
    [rawMembers],
  );

  const isSearching = searchKeyword.length > 0;
  const listTitle = isSearching
    ? `搜索结果 (${members.length})`
    : selectedDept
    ? `${selectedDept.name} (${memberResp?.data?.total ?? 0})`
    : "请选择部门";

  // 自定义树节点图标（紫色风格）
  const iconRender = () => (
    <svg
      className="h-4 w-4 text-[#7c3aed]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );

  const switcherIcon = ({
    expanded,
    isLeaf,
  }: {
    expanded?: boolean;
    isLeaf?: boolean;
  }) =>
    isLeaf ? null : (
      <span
        className={clsx(
          "text-xs text-[#a78bfa] transition-transform duration-150",
          !expanded && "-rotate-90",
        )}
        aria-hidden="true"
      >
        ▾
      </span>
    );

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-base)]">
      {/* 页头 */}
      <div className="flex items-center justify-between px-6 pb-2 pt-6">
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
          <ReloadOutlined
            className={clsx("transition-transform", syncLoading && "animate-spin")}
          />
          同步
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Department Tree (resizable) */}
        <div
          className="relative flex-shrink-0 overflow-y-auto border-r border-[var(--border-color)] p-4"
          style={{ width: treeWidth, minWidth: `${MIN_TREE_WIDTH}px` }}
        >
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
              defaultExpandedKeys={defaultExpandedKeys}
              showIcon
              icon={iconRender()}
              blockNode
              switcherIcon={switcherIcon}
              titleRender={(node) => {
                const nodeClass = getOrganizationNodeClassName(node);
                const nodeTitle = typeof node.title === "string" ? node.title : "";
                return (
                  <span
                    className={clsx(
                      styles.nodeTitle,
                      nodeClass === "branch" ? styles.branchNode : styles.leafNode,
                    )}
                    title={nodeTitle}
                  >
                    {node.title}
                  </span>
                );
              }}
              className={styles.tree}
            />
          )}
          {/* 拖拽调整宽度手柄 */}
          <div
            className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[#7c3aed] active:bg-[#5b21b6]"
            onMouseDown={handleResizeStart}
          />
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
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] py-2.5 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-[var(--text-quaternary)] focus:border-[#a78bfa] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] focus:ring-0"
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
                      text={(
                        member.nickname ||
                        member.displayName ||
                        member.username
                      )?.charAt(0)}
                      size={38}
                      bgColor="#7c3aed"
                      color="#fff"
                    />
                    <div className="ml-3 min-w-0 flex-1 overflow-hidden">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[#7c3aed]">
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
