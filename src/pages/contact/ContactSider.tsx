import { ApartmentOutlined } from "@ant-design/icons";
import { Badge } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import FlexibleSider from "@/components/FlexibleSider";
import { useContactStore } from "@/store";

interface LinkItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const Links: LinkItem[] = [
  {
    label: t("placeholder.recentContact") || "最近联系人",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    path: "/contact",
  },
  {
    label: t("placeholder.groupNotification"),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    path: "/contact/groupNotifications",
  },
  {
    label: t("placeholder.myGroup"),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        <line x1="23" y1="6" x2="23" y2="6.01" />
      </svg>
    ),
    path: "/contact/myGroups",
  },
  {
    label: t("placeholder.organization") || "组织结构",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    path: "/contact/organization",
  },
];

i18n.on("languageChanged", () => {
  Links[0].label = t("placeholder.recentContact") || "最近联系人";
  Links[1].label = t("placeholder.groupNotification");
  Links[2].label = t("placeholder.myGroup");
  Links[3].label = t("placeholder.organization") || "组织结构";
});

const ContactSider = () => {
  const [selectIndex, setSelectIndex] = useState(0);
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash.includes("/contact/groupNotifications")) {
      setSelectIndex(1);
    } else if (location.hash.includes("/contact/myGroups")) {
      setSelectIndex(2);
    } else if (location.hash.includes("/contact/organization")) {
      setSelectIndex(3);
    } else {
      setSelectIndex(0);
    }
  }, []);

  const getBadge = (index: number) => {
    if (index === 1) {
      return unHandleGroupApplicationCount;
    }
    return 0;
  };

  return (
    <FlexibleSider needHidden={true}>
      <div className="flex h-full flex-col bg-[var(--bg-base)]">
        {/* 标题 */}
        <div className="px-5 pt-6 pb-4">
          <div className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t("placeholder.contact")}
          </div>
          <div className="mt-1 text-xs text-[var(--text-quaternary)]">管理联系人与群组</div>
        </div>

        {/* 导航列表 */}
        <ul className="flex-1 space-y-1 px-3">
          {Links.map((item, index) => {
            const isSelected = index === selectIndex;
            return (
              <li
                key={item.path}
                className={clsx(
                  "group relative cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-200",
                  isSelected
                    ? "bg-gradient-to-r from-[#ede9fe] to-[#f5f3ff] dark:from-[#2e1065] dark:to-transparent"
                    : "hover:bg-[var(--bg-hover)]",
                )}
                onClick={() => {
                  setSelectIndex(index);
                  navigate(String(item.path));
                }}
              >
                <div className="flex items-center gap-3">
                  <Badge size="small" count={getBadge(index)} offset={[-2, 2]}>
                    <span
                      className={clsx(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-[#7c3aed] text-white shadow-sm shadow-purple-200 dark:shadow-purple-900/30"
                          : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]",
                      )}
                    >
                      {item.icon}
                    </span>
                  </Badge>
                  <div
                    className={clsx(
                      "text-sm font-medium transition-colors",
                      isSelected
                        ? "text-[#7c3aed]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {item.label}
                  </div>
                </div>
                {/* 选中指示器 */}
                {isSelected && (
                  <div className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#7c3aed]" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </FlexibleSider>
  );
};
export default ContactSider;
