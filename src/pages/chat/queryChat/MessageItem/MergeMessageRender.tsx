import { MessageItem } from "@openim/wasm-client-sdk";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

import { IMessageItemProps } from "./index";
import styles from "./message-item.module.scss";
import MergeMessageDetailModal from "./MergeMessageDetailModal";

const MergeMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const { t } = useTranslation();
  const mergeElem = (message as MessageItem).mergeElem;
  const [detailOpen, setDetailOpen] = useState(false);

  if (!mergeElem) return null;

  return (
    <>
      <div
        className={`${styles.bubble} cursor-pointer hover:opacity-80`}
        onClick={() => setDetailOpen(true)}
      >
        <div className="max-w-[240px]">
          <div className="text-sm font-medium text-[var(--primary-text)]">
            {mergeElem.title}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-[var(--sub-text)]">
            {mergeElem.abstractList?.slice(0, 4).map((abs, idx) => (
              <div key={idx} className="truncate">
                {abs}
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-[var(--gap-text)] pt-1 text-xs text-[var(--sub-text)]">
            {t("messageDescription.mergeMessage")}
          </div>
        </div>
      </div>

      <MergeMessageDetailModal
        open={detailOpen}
        mergeElem={mergeElem}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
};

export default MergeMessageRender;
