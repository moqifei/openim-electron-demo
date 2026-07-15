import { GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Select, Empty } from "antd";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import { useContactStore, useUserStore } from "@/store";
import { emit } from "@/utils/events";

import GroupListItem from "./GroupListItem";

export enum GroupTypeEnum {
  JoinedGroup,
  CreatedGroup,
}

export const MyGroups = () => {
  const { t } = useTranslation();
  const [selectGroup, setSelectGroup] = useState(GroupTypeEnum.CreatedGroup);

  const joinedGroupList = useContactStore((state) => state.groupList);
  const { userID } = useUserStore((state) => state.selfInfo);

  const handleChange = (value: string) => {
    setSelectGroup(Number(value));
  };

  const filterGroup = joinedGroupList.filter((group) => {
    if (selectGroup === GroupTypeEnum.JoinedGroup) {
      return group.creatorUserID !== userID;
    } else if (selectGroup === GroupTypeEnum.CreatedGroup) {
      return group.creatorUserID === userID;
    }
    return false;
  });

  const showGroupCard = useCallback((group: GroupItem) => {
    emit("OPEN_GROUP_CARD", group);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-base)]">
      {/* 页头 */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t("placeholder.myGroup")}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-quaternary)]">
            共 {filterGroup.length} 个群组
          </p>
        </div>
        <Select
          defaultValue={String(selectGroup)}
          popupClassName="p-0"
          className="min-w-[140px]"
          onChange={handleChange}
          options={[
            {
              value: String(GroupTypeEnum.CreatedGroup),
              label: t("placeholder.myCreated"),
            },
            {
              value: String(GroupTypeEnum.JoinedGroup),
              label: t("placeholder.myJoined"),
            },
          ]}
        />
      </div>

      {/* 群组列表 */}
      {!filterGroup.length ? (
        <Empty
          className="mt-[20%]"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-[var(--text-quaternary)]">
              暂无群组
            </span>
          }
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <Virtuoso
            className="h-full overflow-x-hidden"
            data={filterGroup}
            itemContent={(_, group) => (
              <GroupListItem
                key={group.groupID}
                source={group}
                showGroupCard={showGroupCard}
              />
            )}
          />
        </div>
      )}
    </div>
  );
};
