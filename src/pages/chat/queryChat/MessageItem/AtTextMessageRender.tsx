import clsx from "clsx";
import { FC, memo } from "react";

import { formatAtText } from "@/utils/common";
import { useUserStore } from "@/store";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

/**
 * Renders an @-mention (AtText) message with Feishu-style pill tags and
 * per-user read-status dots.
 *
 * Follows the same pattern as MessageSuffix (single-chat read status):
 *   - Reads the current read state directly from message props (no manual
 *     emitter subscription or DOM manipulation).
 *   - When the parent re-renders due to store update (from polling or SDK
 *     callback), this component gets fresh props → generates new HTML with
 *     correct dot classes → React injects via dangerouslySetInnerHTML.
 *   - A `key` derived from the read list forces re-injection even when
 *     memo would otherwise skip the re-render.
 */
const AtTextMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const atTextElem = message.atTextElem;
  if (!atTextElem) return null;

  const text = atTextElem.text || "";
  const atUsersInfo = atTextElem.atUsersInfo;
  const selfID = useUserStore((state) => state.selfInfo.userID);
  const atUserList = atTextElem.atUserList || [];
  const isAtSelf = atTextElem.isAtSelf || atUserList.includes(selfID);

  // Read state — same level as single chat's `message.isRead`
  const hasReadUserIDList =
    message.attachedInfoElem?.groupHasReadInfo?.hasReadUserIDList ?? [];

  // Serialize as JSON so React's key comparison is value-based, not reference-based.
  // This ensures that when polling updates the store with the same array contents,
  // the key stays stable; when contents actually change, the key changes too.
  const readKey = hasReadUserIDList.join(",");

  // Generate HTML with correct dot classes baked in — no post-render DOM surgery.
  const displayContent = formatAtText(text, atUsersInfo, hasReadUserIDList);

  // ── Diagnostic: confirm read-state data reaches render + correct class ──
  if (process.env.NODE_ENV !== "production" && readKey.length > 0) {
    console.log(
      "[AtTextRender] seq:",
      message.seq,
      "readKey:",
      readKey,
      "htmlHasReadDot:",
      displayContent.includes("atDot--read"),
    );
  }

  return (
    <div
      className={clsx(
        styles.bubble,
        styles.atBubble,
        isAtSelf && styles.atSelfBubble,
      )}
      key={readKey}
    >
      <div
        className={styles.atContent}
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
    </div>
  );
};

export default memo(AtTextMessageRender);
