import { SearchOutlined } from "@ant-design/icons";
import { CbEvents, MessageType } from "@openim/wasm-client-sdk";
import {
  GroupItem,
  MessageItem,
  RtcInvite,
  WSEvent,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover } from "antd";
import i18n, { t } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";

import { getBusinessUserInfo } from "@/api/login";
import create_group from "@/assets/images/topSearchBar/create_group.png";
import show_more from "@/assets/images/topSearchBar/show_more.png";
import WindowControlBar from "@/components/WindowControlBar";
import { CustomType } from "@/constants";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import ChooseModal, { ChooseModalState } from "@/pages/common/ChooseModal";
import GroupCardModal from "@/pages/common/GroupCardModal";
import RtcCallModal from "@/pages/common/RtcCallModal";
import { InviteData } from "@/pages/common/RtcCallModal/data";
import UserCardModal, { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore } from "@/store";
import emitter, { OpenUserCardParams } from "@/utils/events";

import { IMSDK } from "../MainContentWrap";
import GlobalSearchModal from "./GlobalSearchModal";

type UserCardState = OpenUserCardParams & {
  cardInfo?: CardInfo;
};

const TopSearchBar = () => {
  const userCardRef = useRef<OverlayVisibleHandle>(null);
  const groupCardRef = useRef<OverlayVisibleHandle>(null);
  const chooseModalRef = useRef<OverlayVisibleHandle>(null);
  const globalSearchModalRef = useRef<OverlayVisibleHandle>(null);
  const rtcRef = useRef<OverlayVisibleHandle>(null);
  const [chooseModalState, setChooseModalState] = useState<ChooseModalState>({
    type: "CRATE_GROUP",
  });
  const [userCardState, setUserCardState] = useState<UserCardState>();
  const [groupCardData, setGroupCardData] = useState<
    GroupItem & { inGroup?: boolean }
  >();
  const [actionVisible, setActionVisible] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData>({} as InviteData);

  useEffect(() => {
    const userCardHandler = (params: OpenUserCardParams) => {
      setUserCardState({ ...params });
      userCardRef.current?.openOverlay();
    };
    const chooseModalHandler = (params: ChooseModalState) => {
      setChooseModalState({ ...params });
      chooseModalRef.current?.openOverlay();
    };
    const callRtcHandler = (inviteData: InviteData) => {
      if (rtcRef.current?.isOverlayOpen) return;
      setInviteData(inviteData);
      rtcRef.current?.openOverlay();
    };
    const newMessageHandler = ({ data }: WSEvent<MessageItem[]>) => {
      if (rtcRef.current?.isOverlayOpen) return;
      let rtcInvite = undefined as undefined | RtcInvite;
      data.map((message) => {
        if (message.contentType === MessageType.CustomMessage) {
          const customData = JSON.parse(message.customElem!.data);
          if (customData.customType === CustomType.CallingInvite) {
            rtcInvite = customData.data;
          }
        }
      });
      if (rtcInvite) {
        getBusinessUserInfo([rtcInvite.inviterUserID]).then(({ data: { users } }) => {
          if (users.length === 0) return;
          setInviteData({
            invitation: rtcInvite,
            participant: {
              userInfo: {
                nickname: users[0].nickname,
                faceURL: users[0].faceURL,
                userID: users[0].userID,
                ex: "",
              },
            },
          });
          rtcRef.current?.openOverlay();
        });
      }
    };

    emitter.on("OPEN_USER_CARD", userCardHandler);
    emitter.on("OPEN_GROUP_CARD", openGroupCardWithData);
    emitter.on("OPEN_CHOOSE_MODAL", chooseModalHandler);
    emitter.on("OPEN_RTC_MODAL", callRtcHandler);
    IMSDK.on(CbEvents.OnRecvNewMessages, newMessageHandler);
    return () => {
      emitter.off("OPEN_USER_CARD", userCardHandler);
      emitter.off("OPEN_GROUP_CARD", openGroupCardWithData);
      emitter.off("OPEN_CHOOSE_MODAL", chooseModalHandler);
      emitter.off("OPEN_RTC_MODAL", callRtcHandler);
      IMSDK.off(CbEvents.OnRecvNewMessages, newMessageHandler);
    };
  }, []);

  const actionClick = (idx: number) => {
    switch (idx) {
      case 2:
        setChooseModalState({ type: "CRATE_GROUP" });
        chooseModalRef.current?.openOverlay();
        break;
      default:
        break;
    }
    setActionVisible(false);
  };

  const openGroupCardWithData = useCallback((group: GroupItem) => {
    const inGroup = useContactStore
      .getState()
      .groupList.some((g) => g.groupID === group.groupID);
    setGroupCardData({ ...group, inGroup });
    groupCardRef.current?.openOverlay();
  }, []);

  return (
    <div className="no-mobile app-drag flex h-12 min-h-[48px] items-center border-b border-[var(--border-color)] bg-[var(--bg-base)]">
      <div className="flex w-full items-center justify-center gap-3">
        <div
          className="app-no-drag flex h-[36px] w-[280px] cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-color)] bg-white px-3 text-sm text-[var(--text-placeholder)] shadow-sm transition-all hover:border-[#7c3aed] hover:shadow-md"
          onClick={() => globalSearchModalRef.current?.openOverlay()}
        >
          <SearchOutlined className="text-[14px] text-[#7c3aed]" />
          <span className="text-[13px]">{t("placeholder.search")}</span>
        </div>
        <Popover
          content={<ActionPopContent actionClick={actionClick} />}
          arrow={false}
          title={null}
          trigger="click"
          placement="bottomRight"
          open={actionVisible}
          onOpenChange={(vis) => setActionVisible(vis)}
        >
          <button
            className="app-no-drag flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
          >
            <img width={18} src={show_more} alt="" />
          </button>
        </Popover>
      </div>
      <WindowControlBar />
      <UserCardModal ref={userCardRef} {...userCardState} />
      <GroupCardModal ref={groupCardRef} groupData={groupCardData} />
      <ChooseModal ref={chooseModalRef} state={chooseModalState} />
      <GlobalSearchModal ref={globalSearchModalRef} />
      <RtcCallModal ref={rtcRef} inviteData={inviteData} />
    </div>
  );
};

export default TopSearchBar;

const actionMenuList = [
  {
    idx: 2,
    title: t("placeholder.createGroup"),
    icon: create_group,
  },
];

i18n.on("languageChanged", () => {
  actionMenuList[0].title = t("placeholder.createGroup");
});

const ActionPopContent = ({ actionClick }: { actionClick: (idx: number) => void }) => {
  return (
    <div className="w-40 p-1.5">
      {actionMenuList.map((action) => (
        <div
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-active)] hover:text-[var(--text-primary)]"
          key={action.idx}
          onClick={() => actionClick?.(action.idx)}
        >
          <img width={18} src={action.icon} alt="" />
          <span>{action.title}</span>
        </div>
      ))}
    </div>
  );
};
