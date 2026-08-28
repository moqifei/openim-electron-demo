import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import type { InputRef } from "antd";
import { Input } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, useEffect, useMemo, useRef, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { getPinyinInitials, toPinyin } from "@/utils/pinyin";

import styles from "./index.module.scss";

export interface AtMemberInfo {
  userID: string;
  nickname: string;
  faceURL: string;
  groupNickname?: string;
}

interface AtMemberPopupProps {
  visible: boolean;
  members: GroupMemberItem[];
  onSelect: (member: AtMemberInfo) => void;
  onClose: () => void;
}

const AtMemberPopup: FC<AtMemberPopupProps> = ({
  visible,
  members,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);

  console.log(
    "[AtMemberPopup] render visible:",
    visible,
    "members count:",
    members?.length,
  );

  // Filter members by nickname, Chinese pinyin, initials, or userID.
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const kw = search.trim().toLowerCase().replace(/\s+/g, "");
    return members.filter((m) => {
      const nickname = m.nickname || "";
      return (
        nickname.toLowerCase().includes(kw) ||
        toPinyin(nickname).includes(kw) ||
        getPinyinInitials(nickname).includes(kw) ||
        m.userID?.toLowerCase().includes(kw)
      );
    });
  }, [members, search]);

  useEffect(() => {
    if (visible) {
      setSearch("");
      setActiveIndex(0);
      // focus the search input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Clamp active index
  useEffect(() => {
    setActiveIndex((prev) => Math.max(0, Math.min(prev, filtered.length)));
  }, [filtered.length]);

  const buildAtInfo = (member: GroupMemberItem): AtMemberInfo => ({
    userID: member.userID,
    nickname: member.nickname,
    faceURL: member.faceURL || "",
    groupNickname: member.nickname,
  });

  const handleSelect = (member: GroupMemberItem) => {
    onSelect(buildAtInfo(member));
  };

  const handleSelectAll = () => {
    onSelect({
      userID: "AtAllTag",
      nickname: t("placeholder.mentionAll"),
      faceURL: "",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = filtered.length + 1; // +1 for @all option
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % total);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + total) % total);
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex === 0) {
          handleSelectAll();
        } else {
          const member = filtered[activeIndex - 1];
          if (member) handleSelect(member);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      default:
        break;
    }
  };

  if (!visible) return null;

  return (
    <div className={styles.popup} onKeyDown={handleKeyDown}>
      <div className={styles.inputWrap}>
        <Input
          ref={inputRef}
          size="small"
          placeholder={t("placeholder.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          allowClear
        />
      </div>
      <div className={styles.list}>
        {/* @所有人 option */}
        <div
          className={clsx(styles.item, activeIndex === 0 && styles.active)}
          onClick={handleSelectAll}
          onMouseEnter={() => setActiveIndex(0)}
        >
          <span className={styles.atLabel}>@</span>
          <span className={styles.allTag}>{t("placeholder.mentionAll")}</span>
        </div>
        {/* Members */}
        {filtered.map((member, idx) => {
          const itemIdx = idx + 1; // offset by @all row
          return (
            <div
              key={member.userID}
              className={clsx(styles.item, activeIndex === itemIdx && styles.active)}
              onClick={() => handleSelect(member)}
              onMouseEnter={() => setActiveIndex(itemIdx)}
            >
              <OIMAvatar size={28} src={member.faceURL} text={member.nickname} />
              <span className={styles.name}>{member.nickname}</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className={styles.empty}>{t("empty.noSearchResults")}</div>
        )}
      </div>
    </div>
  );
};

export default memo(AtMemberPopup);
