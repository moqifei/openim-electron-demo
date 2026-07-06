import clsx from "clsx";
import { useMemo, useState } from "react";

import DigitalTwinSettingPanel, {
  DigitalTwinPanelSection,
} from "@/components/DigitalTwinSettingPanel";
import FlexibleSider from "@/components/FlexibleSider";

const digitalTwinIcon = "/icons/shuzifenshen.png";

const sections: Array<{
  key: DigitalTwinPanelSection;
  title: string;
  description: string;
}> = [
  {
    key: "overview",
    title: "分身总览",
    description: "查看当前分身状态与待处理事项",
  },
  {
    key: "settings",
    title: "接管设置",
    description: "配置触发方式、回复风格与联系人范围",
  },
  {
    key: "skills",
    title: "分身技能",
    description: "生成、查看和管理分身技能",
  },
  {
    key: "records",
    title: "代回记录",
    description: "确认分身回复，标记后续跟进",
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
    <div className="flex min-w-0 flex-1 bg-white">
      <FlexibleSider needHidden={true}>
        <div className="flex h-full flex-col bg-white">
          <div className="px-5.5 pb-4 pt-5.5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0089ff] shadow-[0_8px_18px_rgba(0,137,255,0.22)]">
                <img className="h-7 w-7 object-contain" src={digitalTwinIcon} alt="" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-extrabold text-[#111827]">分身</div>
                  <span className="rounded bg-[#eef7ff] px-1.5 py-0.5 text-[10px] font-medium text-[#0089ff]">
                    仅单聊
                  </span>
                </div>
                <div className="mt-1 text-xs text-[#98a2b3]">你的单聊在线代回助手</div>
              </div>
            </div>
          </div>
          <ul className="px-2">
            {sections.map((section) => {
              const active = section.key === activeSection;
              return (
                <li
                  key={section.key}
                  className={clsx(
                    "mb-2 cursor-pointer rounded-md px-4 py-3 transition-all",
                    active
                      ? "bg-[#f3f8fe] shadow-[inset_3px_0_0_#0089ff]"
                      : "hover:bg-[var(--primary-active)]",
                  )}
                  onClick={() => setActiveSection(section.key)}
                >
                  <div
                    className={clsx(
                      "text-sm font-semibold",
                      active ? "text-[#0089ff]" : "text-[#1f2937]",
                    )}
                  >
                    {section.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#98a2b3]">
                    {section.description}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </FlexibleSider>

      <div className="min-w-0 flex-1 bg-[#f7f9fc]">
        <div className="flex h-[74px] items-center justify-between border-b border-[#edf0f5] bg-white px-8">
          <div>
            <div className="text-xl font-semibold text-[#111827]">
              {activeMeta.title}
            </div>
            <div className="mt-1 text-sm text-[#98a2b3]">
              {activeMeta.description}，当前仅支持单聊分身
            </div>
          </div>
        </div>
        <div className="h-[calc(100%-74px)] overflow-y-auto">
          <div className="mx-auto max-w-[980px]">
            <DigitalTwinSettingPanel activeSection={activeSection} />
          </div>
        </div>
      </div>
    </div>
  );
};
