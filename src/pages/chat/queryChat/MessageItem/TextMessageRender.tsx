import { FC, useMemo } from "react";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

function getMessageFontSize(message: IMessageItemProps["message"]): number | undefined {
  try {
    if (message.ex) {
      const ex: unknown = JSON.parse(message.ex);
      if (
        ex &&
        typeof ex === "object" &&
        "fontSize" in ex &&
        typeof ex.fontSize === "number"
      ) {
        return ex.fontSize;
      }
    }
  } catch {
    // ignore parse error
  }
  return undefined;
}

const TextMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const fontSize = useMemo(() => getMessageFontSize(message), [message]);
  const content = message.textElem?.content || "";

  return (
    <div
      className={styles.bubble}
      style={{
        ...(fontSize ? { fontSize: `${fontSize}px`, lineHeight: 1.5 } : {}),
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </div>
  );
};

export default TextMessageRender;
