import { FC } from "react";

const formatDividerTime = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (sameDay) return `今天 ${hm}`;
  if (isYesterday) return `昨天 ${hm}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
};

const TimeDivider: FC<{ time: number }> = ({ time }) => (
  <div className="flex justify-center py-2">
    <span className="rounded bg-black/[0.04] px-2 py-0.5 text-xs text-[var(--text-tertiary)] select-none">
      {formatDividerTime(time)}
    </span>
  </div>
);

export default TimeDivider;
