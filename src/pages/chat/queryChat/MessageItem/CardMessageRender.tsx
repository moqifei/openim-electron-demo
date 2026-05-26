import { MessageStatus } from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { FC, useCallback } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { emit } from "@/utils/events";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const CardMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const cardElem = message.cardElem;
  const isSending = message.status === MessageStatus.Sending;

  const handleClick = useCallback(() => {
    if (isSending || !cardElem?.userID) return;
    emit("OPEN_USER_CARD", { userID: cardElem.userID });
  }, [cardElem?.userID, isSending]);

  return (
    <div
      className={`${styles.bubble} flex max-w-[240px] cursor-pointer items-center gap-3 px-3 py-2 ${
        isSending ? "" : "hover:opacity-80"
      }`}
      onClick={handleClick}
    >
      <OIMAvatar
        size={40}
        src={cardElem?.faceURL}
        text={cardElem?.nickname}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" title={cardElem?.nickname}>
          {cardElem?.nickname}
        </div>
        <div className="mt-0.5 text-xs text-[var(--sub-text)]">
          {t("placeholder.personalCard")}
        </div>
      </div>
    </div>
  );
};

export default CardMessageRender;
