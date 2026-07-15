import { CbEvents, OnlineState, Platform, SessionType } from "@openim/wasm-client-sdk";
import { UserOnlineState, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { Layout, Tooltip } from "antd";
import { UserOutlined } from "@ant-design/icons";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import group_member from "@/assets/images/chatHeader/group_member.png";
import launch_group from "@/assets/images/chatHeader/launch_group.png";
import settings from "@/assets/images/chatHeader/settings.png";
import OIMAvatar from "@/components/OIMAvatar";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
import { emit } from "@/utils/events";
import { getAgentUserIDSet } from "@/utils/agentRecommendations";
import { isAgentConversation } from "@/utils/agentConversation";

import GroupSetting from "../GroupSetting";
import SingleSetting from "../SingleSetting";

const menuList = [
  {
    title: t("placeholder.createGroup"),
    icon: launch_group,
    idx: 0,
  },
  {
    title: t("placeholder.invitation"),
    icon: launch_group,
    idx: 1,
  },
  {
    title: t("placeholder.setting"),
    icon: settings,
    idx: 2,
  },
];

i18n.on("languageChanged", () => {
  menuList[0].title = t("placeholder.createGroup");
  menuList[1].title = t("placeholder.invitation");
  menuList[2].title = t("placeholder.setting");
});

const platformTextMap: Partial<Record<Platform, string>> = {
  [Platform.iOS]: "iOS",
  [Platform.Android]: "Android",
  [Platform.Windows]: "Windows",
  [Platform.MacOSX]: "MacOSX",
  [Platform.Web]: "Web",
  [Platform.Linux]: "Linux",
  [Platform.AndroidPad]: "AndroidPad",
  [Platform.iPad]: "iPad",
  [Platform.Harmony]: "Harmony",
};

const ORANGE_AGENT_PLATFORM_ID = 12;
const BOT_USER_ID_PREFIX = "bot_";

// 群成员列表(GroupMemberItem)不含 registerType，无法直接在成员对象上判断智能体，
// 改为用群成员 userID 匹配智能体 userID 集合（与 agentRecommendations 一致）。
const getPrimaryPlatformText = (platformIDs?: Platform[]) => {
  const platform = platformIDs?.[0];
  if (!platform) return "";
  if (Number(platform) === ORANGE_AGENT_PLATFORM_ID) return "Orange";
  return platformTextMap[platform] ?? `平台${platform}`;
};

const isOrangeAgentOnlineState = (state?: UserOnlineState) =>
  state?.platformIDs?.some(
    (platform) => Number(platform) === ORANGE_AGENT_PLATFORM_ID,
  ) ?? false;

const pickUserOnlineState = (
  data: UserOnlineState | UserOnlineState[] | undefined,
  userID?: string,
) => {
  if (!data) return undefined;
  if (!Array.isArray(data)) return data.userID === userID ? data : undefined;
  return data.find((item) => item.userID === userID);
};

const ChatHeader = () => {
  const singleSettingRef = useRef<OverlayVisibleHandle>(null);
  const groupSettingRef = useRef<OverlayVisibleHandle>(null);

  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const [onlineState, setOnlineState] = useState<UserOnlineState>();
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const currentUserIsInGroup = useConversationStore((state) =>
    Boolean(state.currentMemberInGroup?.userID),
  );
  const inGroup = useConversationStore((state) =>
    Boolean(state.currentMemberInGroup?.groupID),
  );
  // 智能体成员计数
  const [agentCount, setAgentCount] = useState(0);

  // locale re render
  useUserStore((state) => state.appSettings.locale);

  const isSingleSession = currentConversation?.conversationType === SessionType.Single;
  const isGroupSession = currentConversation?.conversationType === SessionType.Group;
  const currentUserID = currentConversation?.userID;

  // 判断当前会话是否为智能体
  const latestMsgParsed = useMemo(() => {
    if (!currentConversation?.latestMsg) return undefined;
    try { return JSON.parse(currentConversation.latestMsg); } catch { return undefined; }
  }, [currentConversation?.latestMsg]);
  const isAgent = isAgentConversation(currentConversation, latestMsgParsed);

  const displayName = useContactStore((state) => {
    if (!isSingleSession) return currentConversation?.showName;
    const friend = state.friendList.find(
      (f) => f.userID === currentConversation?.userID,
    );
    return friend?.remark || friend?.nickname || currentConversation?.showName;
  });

  useEffect(() => {
    if (singleSettingRef.current?.isOverlayOpen) {
      singleSettingRef.current?.closeOverlay();
    }
    if (groupSettingRef.current?.isOverlayOpen) {
      groupSettingRef.current?.closeOverlay();
    }
  }, [currentConversation?.conversationID]);

  useEffect(() => {
    setOnlineState(undefined);
    if (!isSingleSession || !currentUserID) return;

    let disposed = false;
    const updateOnlineState = (state?: UserOnlineState) => {
      if (!disposed && state?.userID === currentUserID) {
        setOnlineState(state);
      }
    };
    const userStatusChangedHandler = (
      event: WSEvent<UserOnlineState | UserOnlineState[]>,
    ) => {
      updateOnlineState(pickUserOnlineState(event.data, currentUserID));
    };

    IMSDK.on(CbEvents.OnUserStatusChanged, userStatusChangedHandler);
    IMSDK.subscribeUsersStatus([currentUserID])
      .then(({ data }) => {
        updateOnlineState(pickUserOnlineState(data as UserOnlineState, currentUserID));
      })
      .catch((error) => {
        console.warn("subscribe user online status failed", error);
      });

    return () => {
      disposed = true;
      IMSDK.off(CbEvents.OnUserStatusChanged, userStatusChangedHandler);
      IMSDK.unsubscribeUsersStatus([currentUserID]).catch((error) => {
        console.warn("unsubscribe user online status failed", error);
      });
    };
  }, [currentUserID, isSingleSession]);

  // 群聊时获取成员列表，统计智能体数量
  useEffect(() => {
    setAgentCount(0);
    if (!isGroupSession || !currentConversation?.groupID) return;

    let disposed = false;
    Promise.all([
      IMSDK.getGroupMemberList({
        groupID: currentConversation.groupID,
        filter: 0,
        offset: 0,
        count: 500,
      }),
      getAgentUserIDSet(),
    ])
      .then(([{ data }, agentSet]) => {
        if (disposed || !data) return;
        const count = data.filter((m) => agentSet.has(m.userID)).length;
        setAgentCount(count);
      })
      .catch(() => {});

    return () => { disposed = true; };
  }, [currentConversation?.groupID, isGroupSession]);

  const onlineStatusText = useMemo(() => {
    if (!isSingleSession || !onlineState) return "";
    if (onlineState.status !== OnlineState.Online) return "离线";
    if (isOrangeAgentOnlineState(onlineState)) return "Orange在线";
    const platformText = getPrimaryPlatformText(onlineState.platformIDs);
    return `${platformText || ""}在线`;
  }, [isSingleSession, onlineState]);

  const isOnline = onlineState?.status === OnlineState.Online;

  const menuClick = (idx: number) => {
    switch (idx) {
      case 0:
      case 1:
        emit("OPEN_CHOOSE_MODAL", {
          type: isSingleSession ? "CRATE_GROUP" : "INVITE_TO_GROUP",
          extraData: isSingleSession
            ? [{ ...currentConversation }]
            : currentConversation?.groupID,
        });
        break;
      case 2:
        if (isGroupSession) {
          groupSettingRef.current?.openOverlay();
        } else {
          singleSettingRef.current?.openOverlay();
        }
        break;
      default:
        break;
    }
  };

  return (
    <Layout.Header className="relative border-b border-b-[var(--border-color)] !bg-[var(--bg-base)] !px-4">
      <div className="flex h-full items-center leading-none">
        <div className="flex flex-1 items-center overflow-hidden">
          {isAgent ? (
            <div className="rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] p-[2px]">
              <OIMAvatar
                src={currentConversation?.faceURL}
                text={displayName}
                isgroup={Boolean(currentConversation?.groupID)}
                size={36}
                color="#7c3aed"
                className="!bg-white"
              />
            </div>
          ) : (
            <OIMAvatar
              src={currentConversation?.faceURL}
              text={displayName}
              isgroup={Boolean(currentConversation?.groupID)}
              size={40}
            />
          )}
          <div
            className={clsx(
              "ml-3 flex !h-11 flex-1 flex-col justify-center overflow-hidden gap-0.5",
            )}
          >
            <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{displayName}</div>
            {isSingleSession && onlineStatusText && (
              <div
                className={clsx(
                  "flex items-center text-xs",
                  isOnline ? "text-[var(--text-tertiary)]" : "text-[var(--text-placeholder)]",
                )}
              >
                <span
                  className={clsx(
                    "mr-1.5 h-1.5 w-1.5 rounded-full",
                    isOnline ? "bg-[var(--success)]" : "bg-[#c9cdd4]",
                  )}
                />
                <span>{onlineStatusText}</span>
              </div>
            )}
            {isGroupSession && currentUserIsInGroup && (
              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center">
                  <UserOutlined className="mr-1 text-[11px] opacity-50" />
                  {(currentGroupInfo?.memberCount ?? 0) - agentCount}
                </span>
                {agentCount > 0 && (
                  <span className="flex items-center rounded-full bg-[#ede9fe] px-2 py-px text-[11px] font-bold tracking-wider text-[#7c3aed]">
                    AI {agentCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mr-3 flex items-center">
          {menuList.map((menu) => {
            if (menu.idx === 1 && (isSingleSession || (!inGroup && !isSingleSession))) {
              return null;
            }
            if (menu.idx === 0 && !isSingleSession) {
              return null;
            }

            return (
              <Tooltip title={menu.title} key={menu.idx}>
                <button
                  type="button"
                  className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                  onClick={() => menuClick(menu.idx)}
                >
                  <img width={18} src={menu.icon} alt="" />
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <SingleSetting ref={singleSettingRef} />
      <GroupSetting ref={groupSettingRef} />
    </Layout.Header>
  );
};

export default memo(ChatHeader);
