import {
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ForwardOutlined,
  SaveOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { Button } from "antd";
import { t } from "i18next";
import { FC, useMemo } from "react";

import { feedbackToast } from "@/utils/common";

interface IMultiSelectToolbarProps {
  selectedMessages: MessageItem[];
  onForwardOneByOne: () => void;
  onMergeForward: () => void;
  onCopy: () => void;
  onSave: () => void;
  onFavorite: () => void;
  onCancel: () => void;
}

const MultiSelectToolbar: FC<IMultiSelectToolbarProps> = ({
  selectedMessages,
  onForwardOneByOne,
  onMergeForward,
  onCopy,
  onSave,
  onFavorite,
  onCancel,
}) => {
  const canCopy = useMemo(
    () => selectedMessages.some((m) => m.contentType === MessageType.TextMessage),
    [selectedMessages],
  );

  const canSave = useMemo(
    () =>
      selectedMessages.some((m) =>
        [MessageType.PictureMessage, MessageType.FileMessage].includes(m.contentType),
      ),
    [selectedMessages],
  );

  const handleCopy = async () => {
    const textMessages = selectedMessages
      .filter((m) => m.contentType === MessageType.TextMessage)
      .map((m) => m.textElem?.content || "")
      .join("\n");
    if (!textMessages) return;
    try {
      await navigator.clipboard.writeText(textMessages);
      feedbackToast({ msg: t("toast.copySuccess") });
    } catch {
      feedbackToast({ msg: t("toast.copyFailed") });
    }
    onCopy();
  };

  const handleSave = () => {
    // Save logic: trigger download for files/images
    selectedMessages.forEach((msg) => {
      if (msg.contentType === MessageType.FileMessage) {
        const url = msg.fileElem?.sourceUrl;
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = msg.fileElem?.fileName || "download";
          a.click();
        }
      } else if (msg.contentType === MessageType.PictureMessage) {
        const url = msg.pictureElem?.sourcePicture?.url;
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = "image";
          a.click();
        }
      }
    });
    onSave();
  };

  return (
    <div className="absolute bottom-0 left-0 z-50 flex w-full items-center justify-between border-t border-[var(--gap-text)] bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <ToolbarButton
          icon={<ForwardOutlined />}
          label={t("placeholder.forward")}
          onClick={onForwardOneByOne}
        />
        <ToolbarButton
          icon={<FileTextOutlined />}
          label={t("placeholder.mergeForward")}
          onClick={onMergeForward}
        />
        {canCopy && (
          <ToolbarButton icon={<CopyOutlined />} label={t("placeholder.copy")} onClick={handleCopy} />
        )}
        {canSave && (
          <ToolbarButton icon={<SaveOutlined />} label={t("placeholder.save")} onClick={handleSave} />
        )}
        <ToolbarButton
          icon={<StarOutlined />}
          label={t("placeholder.favorite")}
          onClick={onFavorite}
        />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--sub-text)]">
          {selectedMessages.length} / 50
        </span>
        <Button onClick={onCancel}>{t("close")}</Button>
      </div>
    </div>
  );
};

const ToolbarButton: FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick,
}) => (
  <button
    className="flex flex-col items-center gap-1 text-[var(--primary-text)] hover:text-[var(--primary)]"
    onClick={onClick}
  >
    <span className="text-lg">{icon}</span>
    <span className="text-xs">{label}</span>
  </button>
);

export default MultiSelectToolbar;
