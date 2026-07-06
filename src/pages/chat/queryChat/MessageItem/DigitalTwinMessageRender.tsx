import clsx from "clsx";
import { FC, memo } from "react";

import { formatBr } from "@/utils/common";
import { extractDigitalTwinText } from "@/utils/digitalTwinMessage";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const aiIcon = "/icons/a-iconai.png";

const DigitalTwinMessageRender: FC<IMessageItemProps> = ({ message, isSender }) => {
  const text = extractDigitalTwinText(message) || "数字分身消息";
  const displayContent = formatBr(text);

  return (
    <div
      className={clsx(
        styles.bubble,
        styles.digitalTwinBubble,
        isSender && styles.digitalTwinBubbleSender,
      )}
    >
      <div className={styles.digitalTwinBadge}>
        <img className={styles.digitalTwinBadgeIcon} src={aiIcon} alt="" />
        <span>AI 分身代回</span>
      </div>
      <div
        className={styles.digitalTwinContent}
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </div>
  );
};

export default memo(DigitalTwinMessageRender);
