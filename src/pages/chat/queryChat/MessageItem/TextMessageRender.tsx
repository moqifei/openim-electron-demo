import { FC, useMemo } from "react";

import { formatBr } from "@/utils/common";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

function getMessageFontSize(message: IMessageItemProps["message"]): number | undefined {
  try {
    if (message.ex) {
      const ex = JSON.parse(message.ex);
      if (ex.fontSize && typeof ex.fontSize === "number") {
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
  let content = message.textElem?.content;

  content = formatBr(content!);

  return (
    <div
      className={styles.bubble}
      style={fontSize ? { fontSize: `${fontSize}px`, lineHeight: 1.5 } : undefined}
      dangerouslySetInnerHTML={{ __html: content }}
    ></div>
  );
};

export default TextMessageRender;
