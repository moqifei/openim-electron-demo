import { t } from "i18next";
import { FC, memo } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const emojis = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊",
  "😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪",
  "😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏",
  "😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕",
  "🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓",
  "🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧",
  "😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫",
  "🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹",
  "👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀",
  "😿","😾","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
  "❣️","💕","💞","💓","💗","💖","💘","💝","👍","👎","👏","🙌",
  "🤝","🙏","✌️","🤞","🤟","🤘","👌","🤌","🤏","👈","👉","👆",
];

const EmojiPicker: FC<EmojiPickerProps> = ({ onSelect }) => {
  return (
    <div className="w-72 p-2">
      <div className="mb-1 px-1 text-xs font-medium text-[var(--text-tertiary)]">
        {t("placeholder.emoji")}
      </div>
      <div className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded hover:bg-[var(--primary-active)]"
            onClick={() => onSelect(emoji)}
          >
            <span className="text-lg leading-none">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default memo(EmojiPicker);
