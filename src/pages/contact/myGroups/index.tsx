import { SessionType } from "@openim/wasm-client-sdk";
import { GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Empty, Select } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
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
  const getGroupListByReq = useContactStore((state) => state.getGroupListByReq);
  const setGroupList = useContactStore((state) => state.setGroupList);
  const conversationList = useConversationStore((state) => state.conversationList);
  const { userID } = useUserStore((state) => state.selfInfo);

  const joinedGroupConversationIDs = useMemo(
    () =>
      Array.from(
        new Set(
          conversationList
            .filter(
              (conversation) =>
                (conversation.conversationType === SessionType.Group ||
                  conversation.conversationType === SessionType.WorkingGroup) &&
                conversation.groupID &&
                !conversation.isNotInGroup,
            )
            .map((conversation) => conversation.groupID),
        ),
      ).sort(),
    [conversationList],
  );
  const joinedGroupConversationKey = joinedGroupConversationIDs.join("|");

  useEffect(() => {
    let cancelled = false;

    const syncGroupList = async () => {
      await getGroupListByReq();
      if (cancelled) return;

      const currentGroupIDs = new Set(
        useContactStore.getState().groupList.map((group) => group.groupID),
      );
      const missingGroupIDs = joinedGroupConversationIDs.filter(
        (groupID) => !currentGroupIDs.has(groupID),
      );
      if (!missingGroupIDs.length) return;

      try {
        const { data } = await IMSDK.getSpecifiedGroupsInfo(missingGroupIDs);
        if (cancelled || !data.length) return;
        const groupMap = new Map(
          useContactStore.getState().groupList.map((group) => [group.groupID, group]),
        );
        data.forEach((group) => groupMap.set(group.groupID, group));
        setGroupList(Array.from(groupMap.values()));
      } catch (error) {
        console.warn("[MyGroups] recover missing groups failed", error);
      }
    };

    void syncGroupList();
    return () => {
      cancelled = true;
    };
  }, [getGroupListByReq, joinedGroupConversationKey, setGroupList]);

  const handleChange = (value: string) => {
    setSelectGroup(Number(value));
  };

  const filterGroup = joinedGroupList.filter((group) => {
    if (selectGroup === GroupTypeEnum.JoinedGroup) {
      return true;
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
      <div className="flex items-center justify-between px-6 pb-3 pt-6">
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
          description={<span className="text-[var(--text-quaternary)]">暂无群组</span>}
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
