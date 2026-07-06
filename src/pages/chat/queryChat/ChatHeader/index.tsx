import { CbEvents, OnlineState, Platform, SessionType } from "@openim/wasm-client-sdk";
import { UserOnlineState, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { Layout, Tooltip } from "antd";
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

  // locale re render
  useUserStore((state) => state.appSettings.locale);

  const isSingleSession = currentConversation?.conversationType === SessionType.Single;
  const isGroupSession = currentConversation?.conversationType === SessionType.Group;
  const currentUserID = currentConversation?.userID;

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
    <Layout.Header className="relative border-b border-b-[var(--gap-text)] !bg-white !px-3">
      <div className="flex h-full items-center leading-none">
        <div className="flex flex-1 items-center overflow-hidden">
          <OIMAvatar
            src={currentConversation?.faceURL}
            text={displayName}
            isgroup={Boolean(currentConversation?.groupID)}
          />
          <div
            className={clsx(
              "ml-3 flex !h-10.5 flex-1 flex-col justify-between overflow-hidden",
            )}
          >
            <div className="truncate text-base font-semibold">{displayName}</div>
            {isSingleSession && onlineStatusText && (
              <div
                className={clsx(
                  "flex items-center text-xs",
                  isOnline ? "text-[var(--sub-text)]" : "text-[#98a2b3]",
                )}
              >
                <span
                  className={clsx(
                    "mr-2 h-1.5 w-1.5 rounded-full",
                    isOnline ? "bg-[#17c964]" : "bg-[#c7ced9]",
                  )}
                />
                <span>{onlineStatusText}</span>
              </div>
            )}
            {isGroupSession && currentUserIsInGroup && (
              <div className="flex items-center text-xs text-[var(--sub-text)]">
                <img width={20} src={group_member} alt="member" />
                <span>{currentGroupInfo?.memberCount}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mr-5 flex">
          {menuList.map((menu) => {
            if (menu.idx === 1 && (isSingleSession || (!inGroup && !isSingleSession))) {
              return null;
            }
            if (menu.idx === 0 && !isSingleSession) {
              return null;
            }

            return (
              <Tooltip title={menu.title} key={menu.idx}>
                <img
                  className="ml-5 cursor-pointer"
                  width={20}
                  src={menu.icon}
                  alt=""
                  onClick={() => menuClick(menu.idx)}
                />
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
