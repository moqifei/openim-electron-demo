import { useTranslation } from "react-i18next";

export const EmptyChat = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--bg-body)]">
      <svg
        width="160"
        height="120"
        viewBox="0 0 160 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 背景圆 */}
        <circle cx="80" cy="60" r="52" fill="#EDF1F7" />
        {/* 聊天气泡 */}
        <rect x="44" y="40" width="48" height="34" rx="10" fill="#FFFFFF" stroke="#D5DCE6" strokeWidth="1.5" />
        <path d="M56 74 L56 84 L68 74 Z" fill="#FFFFFF" stroke="#D5DCE6" strokeWidth="1.5" />
        {/* 气泡内文字线 */}
        <rect x="54" y="50" width="20" height="3.5" rx="1.75" fill="#C9D2DE" />
        <rect x="54" y="58" width="28" height="3.5" rx="1.75" fill="#DCE3EC" />
        {/* 第二气泡 */}
        <rect x="72" y="56" width="44" height="30" rx="10" fill="#3370FF" opacity="0.12" />
        <rect x="82" y="65" width="24" height="3.5" rx="1.75" fill="#3370FF" opacity="0.5" />
        <rect x="82" y="72" width="16" height="3.5" rx="1.75" fill="#3370FF" opacity="0.3" />
        {/* 小装饰点 */}
        <circle cx="118" cy="38" r="4" fill="#FFB740" opacity="0.8" />
        <circle cx="40" cy="82" r="3" fill="#34C724" opacity="0.7" />
      </svg>
      <div className="mt-4 text-sm font-medium text-[var(--text-tertiary)]">
        {t("placeholder.conversation")}
      </div>
      <div className="mt-1 text-xs text-[var(--text-placeholder)]">
        选择一个会话开始聊天
      </div>
    </div>
  );
};
