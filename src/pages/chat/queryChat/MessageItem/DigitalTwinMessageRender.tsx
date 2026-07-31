import clsx from "clsx";
import { FC, memo } from "react";

import { formatBr } from "@/utils/common";
import {
  extractDigitalTwinText,
  extractDigitalTwinCitations,
} from "@/utils/digitalTwinMessage";
import { publicAsset } from "@/utils/publicAsset";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const aiIcon = publicAsset("icons/a-iconai.png");

const DigitalTwinMessageRender: FC<IMessageItemProps> = ({ message, isSender }) => {
  const text = extractDigitalTwinText(message) || "数字分身消息";
  const displayContent = formatBr(text);
  const citations = extractDigitalTwinCitations(message);

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
      {citations.length > 0 && (
        <div className={styles.digitalTwinCitations}>
          <div className={styles.digitalTwinCitationsTitle}>
            <span>📚</span>
            <span>参考来源（知识库）</span>
          </div>
          {citations.map((c, i) => (
            <div className={styles.digitalTwinCitationItem} key={i}>
              <span>📄</span>
              <span className={styles.digitalTwinCitationDoc}>
                {c.title || "未命名文档"}
                {c.spaceName ? (
                  <span className={styles.digitalTwinCitationSpace}> · {c.spaceName}</span>
                ) : null}
              </span>
              {typeof c.relevanceScore === "number" && (
                <span className={styles.digitalTwinCitationScore}>
                  {c.relevanceScore.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(DigitalTwinMessageRender);
