import { DownOutlined, UpOutlined } from "@ant-design/icons";
import clsx from "clsx";
import { FC, memo, useEffect, useMemo, useState } from "react";

import { getAgentStreamPayload } from "@/utils/agentStreamMessage";
import { formatBr } from "@/utils/common";
import { emit } from "@/utils/events";
import { publicAsset } from "@/utils/publicAsset";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const aiIcon = publicAsset("icons/a-iconai.png");
const STREAM_ANIMATE_WINDOW_MS = 10_000;

const shouldAnimatePayload = (updatedAt?: number) => {
  if (!updatedAt) return true;
  return Date.now() - updatedAt < STREAM_ANIMATE_WINDOW_MS;
};

const AgentStreamMessageRender: FC<IMessageItemProps> = ({ message, isSender }) => {
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const payload = getAgentStreamPayload(message);
  const answer = payload?.answerText || "";
  const reasoning = payload?.reasoningText || "";
  const isDone = payload?.status === "done";
  const isError = payload?.status === "error";
  const shouldAnimate = shouldAnimatePayload(payload?.updatedAt);
  const [displayAnswer, setDisplayAnswer] = useState(() =>
    shouldAnimate ? "" : answer,
  );
  const [displayReasoning, setDisplayReasoning] = useState(() =>
    shouldAnimate ? "" : reasoning,
  );

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayAnswer(answer);
      return;
    }
    if (!answer) {
      setDisplayAnswer("");
      return;
    }

    setDisplayAnswer((current) => {
      if (answer.startsWith(current)) return current;
      return "";
    });
    const timer = window.setInterval(() => {
      setDisplayAnswer((current) => {
        if (current === answer) {
          window.clearInterval(timer);
          return current;
        }
        if (!answer.startsWith(current)) return answer;
        const remain = answer.length - current.length;
        const step = Math.max(1, Math.ceil(remain / 18));
        emit("CHAT_LIST_STICK_TO_BOTTOM");
        return answer.slice(0, current.length + step);
      });
    }, 28);
    return () => window.clearInterval(timer);
  }, [answer, shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayReasoning(reasoning);
      return;
    }
    if (!reasoning) {
      setDisplayReasoning("");
      return;
    }

    setDisplayReasoning((current) => {
      if (reasoning.startsWith(current)) return current;
      return "";
    });
    const timer = window.setInterval(() => {
      setDisplayReasoning((current) => {
        if (current === reasoning) {
          window.clearInterval(timer);
          return current;
        }
        if (!reasoning.startsWith(current)) return reasoning;
        const remain = reasoning.length - current.length;
        const step = Math.max(2, Math.ceil(remain / 16));
        emit("CHAT_LIST_STICK_TO_BOTTOM");
        return reasoning.slice(0, current.length + step);
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [reasoning, shouldAnimate]);

  const answerHtml = useMemo(() => formatBr(displayAnswer || " "), [displayAnswer]);
  const reasoningHtml = useMemo(() => formatBr(displayReasoning), [displayReasoning]);
  const visualDone =
    isDone && displayAnswer === answer && displayReasoning === reasoning;

  return (
    <div
      className={clsx(
        styles.bubble,
        styles.agentStreamBubble,
        isSender && styles.agentStreamBubbleSender,
      )}
    >
      <div className={styles.agentStreamHeader}>
        <div className={styles.agentStreamBadge}>
          <img className={styles.agentStreamBadgeIcon} src={aiIcon} alt="" />
          <span>AI 智能体</span>
        </div>
        <span
          className={clsx(
            styles.agentStreamStatus,
            visualDone && styles.agentStreamStatusDone,
            isError && styles.agentStreamStatusError,
          )}
        >
          {isError ? "生成异常" : visualDone ? "已完成" : answer ? "回复中" : "思考中"}
        </span>
      </div>

      {reasoning && (
        <div className={styles.agentReasoningBox}>
          <button
            className={styles.agentReasoningTitle}
            type="button"
            onClick={() => setThinkingOpen((value) => !value)}
          >
            <span>思考过程</span>
            {thinkingOpen ? <UpOutlined /> : <DownOutlined />}
          </button>
          {thinkingOpen && (
            <div
              className={styles.agentReasoningContent}
              dangerouslySetInnerHTML={{ __html: reasoningHtml }}
            />
          )}
        </div>
      )}

      {isError && payload?.errorText ? (
        <div className={styles.agentStreamError}>{payload.errorText}</div>
      ) : (
        <div className={styles.agentStreamAnswer}>
          <span dangerouslySetInnerHTML={{ __html: answerHtml }} />
          {(!visualDone || displayAnswer !== answer) && !isError && (
            <span className={styles.agentStreamCursor} />
          )}
        </div>
      )}
    </div>
  );
};

export default memo(AgentStreamMessageRender);
