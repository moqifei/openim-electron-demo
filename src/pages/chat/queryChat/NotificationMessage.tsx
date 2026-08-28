import { MessageItem } from "@openim/wasm-client-sdk";
import clsx from "clsx";
import { FC, memo, useRef } from "react";

import { notificationMessageFormat } from "@/utils/imCommon";
import { getShakeMessageText, isShakeMessageData } from "@/utils/shakeMessage";

const NotificationMessage: FC<{
  message: MessageItem;
}> = ({ message }) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const shakeText = isShakeMessageData(message.customElem?.data)
    ? getShakeMessageText(message.customElem?.data, message.senderNickname)
    : "";

  return (
    <div
      className="relative flex justify-center py-2"
      id={`chat_${message.clientMsgID}`}
    >
      <div
        ref={messageWrapRef}
        className={clsx(
          "max-w-[80%] select-none rounded bg-black/[0.04] px-3 py-1 text-center text-xs leading-5 text-[var(--text-tertiary)]",
        )}
        dangerouslySetInnerHTML={{
          __html: shakeText || String(notificationMessageFormat(message)),
        }}
      ></div>
    </div>
  );
};

export default memo(NotificationMessage);
