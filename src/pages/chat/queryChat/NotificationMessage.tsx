import { MessageItem } from "@openim/wasm-client-sdk";
import clsx from "clsx";
import { FC, memo, useRef } from "react";

import { notificationMessageFormat } from "@/utils/imCommon";

const NotificationMessage: FC<{
  message: MessageItem;
}> = ({ message }) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative flex justify-center py-2"
      id={`chat_${message.clientMsgID}`}
    >
      <div
        ref={messageWrapRef}
        className={clsx(
          "max-w-[80%] rounded bg-black/[0.04] px-3 py-1 text-center text-xs leading-5 text-[var(--text-tertiary)] select-none",
        )}
        dangerouslySetInnerHTML={{
          __html: String(notificationMessageFormat(message)),
        }}
      ></div>
    </div>
  );
};

export default memo(NotificationMessage);
