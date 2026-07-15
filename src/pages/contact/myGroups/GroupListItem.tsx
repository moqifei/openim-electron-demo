import { GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";

import OIMAvatar from "@/components/OIMAvatar";

const GroupListItem = ({
  source,
  showGroupCard,
}: {
  source: GroupItem;
  showGroupCard: (group: GroupItem) => void;
}) => {
  return (
    <div
      className="group mx-0.5 flex cursor-pointer items-center rounded-xl px-4 py-3 transition-all duration-150 hover:bg-[var(--bg-hover)] active:scale-[0.99]"
      onClick={() => showGroupCard(source)}
    >
      <OIMAvatar src={source?.faceURL} isgroup size={40} />
      <div className="ml-3 min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[#7c3aed] transition-colors">
          {source.groupName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-quaternary)]">
          <svg className="h-3.5 w-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span>{source.memberCount ?? 0} 人</span>
        </div>
      </div>
    </div>
  );
};

export default GroupListItem;
