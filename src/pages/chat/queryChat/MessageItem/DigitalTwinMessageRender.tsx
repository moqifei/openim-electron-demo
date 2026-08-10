import clsx from "clsx";
import { FC, memo, useState } from "react";

import { formatBr } from "@/utils/common";
import {
  extractDigitalTwinText,
  extractDigitalTwinCitations,
} from "@/utils/digitalTwinMessage";
import { publicAsset } from "@/utils/publicAsset";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const aiIcon = publicAsset("icons/a-iconai.png");

const CitationItem: FC<{ citation: ReturnType<typeof extractDigitalTwinCitations>[number] }> = ({
  citation,
}) => {
  const [expanded, setExpanded] = useState(false);
  const detail = citation.detail;
  const hasDetail = Boolean(detail?.content_md);
  const canExpand = hasDetail;
  return (
    <div className={styles.digitalTwinCitationItem}>
      <span>📄</span>
      <div className={styles.digitalTwinCitationBody}>
        <div className={styles.digitalTwinCitationRow}>
          <button
            type="button"
            className={styles.digitalTwinCitationDoc}
            onClick={() => canExpand && setExpanded((v) => !v)}
          >
            {citation.title || "未命名文档"}
            {citation.spaceName ? (
              <span className={styles.digitalTwinCitationSpace}> · {citation.spaceName}</span>
            ) : null}
            {canExpand && (
              <span className={styles.digitalTwinCitationToggle}>
                {expanded ? " ▾ 收起详情" : " ▸ 查看详情"}
              </span>
            )}
          </button>
          {typeof citation.relevanceScore === "number" && (
            <span className={styles.digitalTwinCitationScoreWrap}>
              <span className={styles.digitalTwinCitationScore}>
                {citation.relevanceScore.toFixed(2)}
              </span>
              <span className={styles.digitalTwinCitationScoreInfo}>
                ⓘ
                <span className={styles.digitalTwinCitationScoreTip}>
                  相似度：知识库返回知识条目和这个问题的相似程度
                </span>
              </span>
            </span>
          )}
        </div>
        {expanded && hasDetail && (
          <div className={styles.digitalTwinCitationDetail}>
            {detail?.summary ? (
              <div className={styles.digitalTwinCitationSummary}>
                {detail.summary}
              </div>
            ) : null}
            {hasDetail && (
              <pre className={styles.digitalTwinCitationContent}>
                {detail?.content_md}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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
            <CitationItem key={i} citation={c} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(DigitalTwinMessageRender);
