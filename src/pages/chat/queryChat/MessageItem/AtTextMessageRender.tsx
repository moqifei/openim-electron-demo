import clsx from "clsx";
import { t } from "i18next";
import { FC, memo } from "react";

import { formatBr } from "@/utils/common";
import { useUserStore } from "@/store";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const AtTextMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const atTextElem = message.atTextElem;
  if (!atTextElem) return null;

  const text = atTextElem.text || "";
  const atUserList = atTextElem.atUserList || [];
  const selfID = useUserStore((state) => state.selfInfo.userID);
  const isAtSelf = atTextElem.isAtSelf || atUserList.includes(selfID);

  const displayContent = formatBr(text);

  return (
    <div
      className={clsx(
        styles.bubble,
        styles.atBubble,
        isAtSelf && styles.atSelfBubble,
      )}
    >
      {isAtSelf && (
        <div className={styles.atBadge}>
          {t("atYouPrefix")}
        </div>
      )}
      <div
        className={styles.atContent}
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </div>
  );
};

export default memo(AtTextMessageRender);
