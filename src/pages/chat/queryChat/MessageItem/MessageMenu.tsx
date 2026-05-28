import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { FC, useEffect, useRef } from "react";

import { feedbackToast } from "@/utils/common";

interface IMessageMenuProps {
  message: MessageItem;
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onForward: () => void;
  onReply: () => void;
  onMultiSelect: () => void;
  onDelete: () => void;
}

const MessageMenu: FC<IMessageMenuProps> = ({
  message,
  visible,
  x,
  y,
  onClose,
  onForward,
  onReply,
  onMultiSelect,
  onDelete,
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
    { label: t("placeholder.delete"), onClick: onDelete },
  ];

  // Adjust position to keep menu within viewport
  const menuWidth = 120;
  const menuHeight = menuItems.length * 36 + 8;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] rounded-md bg-white py-1 shadow-lg"
      style={{
        left: adjustedX,
        top: adjustedY,
        minWidth: menuWidth,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}
    >
      {menuItems.map((item, idx) => (
        <div
          key={idx}
          className="cursor-pointer px-4 py-2 text-sm text-[var(--primary-text)] hover:bg-[var(--chat-bubble)]"
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
