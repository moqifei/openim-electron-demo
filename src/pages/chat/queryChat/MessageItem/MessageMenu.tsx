import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { FC, useEffect, useRef } from "react";

import { feedbackToast } from "@/utils/common";

interface IMessageMenuProps {
  message: MessageItem;
  visible: boolean;
  x: number;
  y: number;
  isSender?: boolean;
  onClose: () => void;
  onForward: () => void;
  onReply: () => void;
  onMultiSelect: () => void;
  onRevoke: () => void;
}

const MessageMenu: FC<IMessageMenuProps> = ({
  message,
  visible,
  x,
  y,
  isSender,
  onClose,
  onForward,
  onReply,
  onMultiSelect,
  onRevoke,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [visible, onClose]);

  if (!visible) return null;

  const isTextMessage = message.contentType === MessageType.TextMessage;

  const handleCopy = async () => {
    try {
      const text = message.textElem?.content || "";
      await navigator.clipboard.writeText(text);
      feedbackToast({ msg: t("toast.copySuccess") });
    } catch {
      feedbackToast({ msg: t("toast.copyFailed") });
    }
    onClose();
  };

  const menuItems = [
    { label: t("placeholder.forward"), onClick: onForward },
    { label: t("placeholder.reply"), onClick: onReply },
    ...(isTextMessage ? [{ label: t("placeholder.copy"), onClick: handleCopy }] : []),
    { label: t("placeholder.check"), onClick: onMultiSelect },
    // 审计要求：仅允许撤销自己发送的消息，群主/管理员/其他人都不能撤销他人的消息。
    ...(isSender
      ? [{ label: t("placeholder.revoke"), onClick: onRevoke }]
      : []),
  ];

  // Adjust position to keep menu within viewport
  const menuWidth = 124;
  const menuHeight = menuItems.length * 34 + 8;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] rounded-lg border border-[var(--border-color)] bg-white py-1 shadow-[0_4px_16px_rgba(31,35,41,0.12)]"
      style={{
        left: adjustedX,
        top: adjustedY,
        minWidth: menuWidth,
      }}
    >
      {menuItems.map((item, idx) => (
        <div
          key={idx}
          className="cursor-pointer px-4 py-1.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};

export default MessageMenu;
