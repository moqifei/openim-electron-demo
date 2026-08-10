import clsx from "clsx";
import { useMemo, useState } from "react";

import DigitalTwinSettingPanel, {
  DigitalTwinPanelSection,
} from "@/components/DigitalTwinSettingPanel";
import FlexibleSider from "@/components/FlexibleSider";
import { publicAsset } from "@/utils/publicAsset";

const digitalTwinIcon = publicAsset("icons/shuzifenshen.png");

const sections: Array<{
  key: DigitalTwinPanelSection;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    key: "overview",
    title: "分身总览",
    description: "查看当前分身状态与待处理事项",
    icon: "📊",
  },
  {
    key: "settings",
    title: "接管设置",
    description: "配置触发方式、回复风格与联系人范围",
    icon: "⚙️",
  },
  {
    key: "skills",
    title: "分身技能",
    description: "生成、查看和管理分身技能",
    icon: "✨",
  },
  {
    key: "knowledge",
    title: "知识库能力",
    description: "配置知识库检索与回答策略",
    icon: "📚",
  },
  {
    key: "records",
    title: "代回记录",
    description: "确认分身回复，标记后续跟进",
    icon: "📋",
  },
  {
    key: "selftest",
    title: "分身自测",
    description: "无需他人发消息，自助验证分身与知识库效果",
    icon: "🧪",
  },
];

export const DigitalTwin = () => {
  const [activeSection, setActiveSection] =
    useState<DigitalTwinPanelSection>("overview");
  const activeMeta = useMemo(
    () => sections.find((section) => section.key === activeSection) ?? sections[0],
    [activeSection],
  );

  return (
    <div className="flex min-w-0 flex-1 bg-[var(--bg-body)]">
      <FlexibleSider needHidden={true}>
        <div className="flex h-full flex-col bg-[var(--bg-base)]">
          {/* 侧边栏头部 */}
          <div className="px-5 pb-4 pt-5.5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
                <img className="h-7 w-7 object-contain brightness-0 invert" src={digitalTwinIcon} alt="" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-extrabold text-[var(--text-primary)]">分身</div>
                  <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c3aed]">
                    仅单聊
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">你的单聊在线代回助手</div>
              </div>
            </div>
          </div>

          {/* 导航菜单 */}
          <ul className="mx-2 mb-2 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {sections.map((section) => {
              const active = section.key === activeSection;
              return (
                <li
                  key={section.key}
                  className={clsx(
                    "group cursor-pointer rounded-xl px-4 py-3 transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-[#ede9fe] to-transparent shadow-sm"
                      : "hover:bg-[var(--bg-hover)]",
                  )}
                  onClick={() => setActiveSection(section.key)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={clsx(
                      "text-base transition-colors",
                      active ? "opacity-100" : "opacity-40 group-hover:opacity-70",
                    )}>
                      {section.icon}
                    </span>
                    <div className={clsx(
                      "text-sm font-semibold transition-colors",
                      active ? "text-[#7c3aed]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]",
                    )}>
                      {section.title}
                    </div>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#7c3aed]" />
                    )}
                  </div>
                  <div className="mt-1 pl-8 line-clamp-1 text-xs leading-5 text-[var(--text-quaternary)]">
                    {section.description}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </FlexibleSider>

      {/* 右侧内容区 */}
      <div className="min-w-0 flex-1 bg-[var(--bg-body)]">
        <div className="flex h-[74px] items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-base)] px-8">
          <div>
            <div className="flex items-center gap-2.5 text-xl font-semibold text-[var(--text-primary)]">
              <span>{activeMeta.icon}</span>
              <span>{activeMeta.title}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--text-tertiary)]">
              {activeMeta.description}
            </div>
          </div>
        </div>
        <div className="h-[calc(100%-74px)] overflow-y-auto">
          <div className="mx-auto max-w-[900px] px-6 py-6">
            <DigitalTwinSettingPanel activeSection={activeSection} />
          </div>
        </div>
      </div>
    </div>
  );
};
