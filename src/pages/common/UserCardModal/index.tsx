import { CbEvents } from "@openim/wasm-client-sdk";
import { SessionType } from "@openim/wasm-client-sdk";
import {
  FriendUserItem,
  GroupMemberItem,
  WSEvent,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { useLatest } from "ahooks";
import { Button, Divider, Spin } from "antd";
import dayjs from "dayjs";
import { t } from "i18next";
import {
  FC,
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery } from "react-query";
import { useCopyToClipboard } from "react-use";

import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import EditableContent from "@/components/EditableContent";
import OIMAvatar from "@/components/OIMAvatar";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";

import EditSelfInfo from "./EditSelfInfo";
import SendRequest from "./SendRequest";

interface IUserCardModalProps {
  userID?: string;
  groupID?: string;
  isSelf?: boolean;
  notAdd?: boolean;
  cardInfo?: CardInfo;
}

export type CardInfo = Partial<BusinessUserInfo & FriendUserItem>;

const getGender = (gender: number) => {
  if (!gender) return "-";
  return gender === 1 ? t("placeholder.man") : t("placeholder.female");
};

const UserCardModal: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  IUserCardModalProps
> = (props, ref) => {
  const { userID, isSelf, notAdd } = props;

  const editInfoRef = useRef<OverlayVisibleHandle>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo>();
  const [isSendRequest, setIsSendRequest] = useState(false);
  const [userFields, setUserFields] = useState<FieldRow[]>([]);

  const selfInfo = useUserStore((state) => state.selfInfo);
  const isFriendUser = useContactStore(
    (state) => state.friendList.findIndex((item) => item.userID === userID) !== -1,
  );

  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);
  const { toSpecifiedConversation } = useConversationToggle();
  const [_, copyToClipboard] = useCopyToClipboard();

  const getCardInfo = async (): Promise<{
    cardInfo: CardInfo;
    memberInfo?: GroupMemberItem | null;
  }> => {
    if (isSelf) {
      return {
        cardInfo: selfInfo,
      };
    }
    let userInfo: CardInfo | null = null;
    const friendInfo = useContactStore
      .getState()
      .friendList.find((item) => item.userID === userID);
    if (friendInfo) {
      userInfo = { ...friendInfo };
    } else {
      const { data } = await IMSDK.getUsersInfo([userID!]);
      userInfo = { ...(data[0] ?? {}) };
    }

    try {
      const {
        data: { users },
      } = await getBusinessUserInfo([userID!]);
      userInfo = { ...userInfo, ...users[0] };
    } catch (error) {
      console.error("get business user info failed", userID, error);
    }
    return {
      cardInfo: userInfo,
    };
  };

  const refreshData = (data?: { cardInfo: CardInfo | null }) => {
    if (!data) {
      return;
    }
    const { cardInfo } = data;

    setCardInfo(cardInfo!);
    setUserInfoRow(cardInfo!);
  };

  const {
    data: fullCardInfo,
    isLoading,
    refetch,
  } = useQuery(["userInfo", userID], getCardInfo, {
    enabled: isOverlayOpen && Boolean(userID),
    onSuccess: refreshData,
  });

  const latestFullCardInfo = useLatest(fullCardInfo);

  useEffect(() => {
    if (!isOverlayOpen) return;
    const friendAddedHandler = ({ data }: WSEvent<FriendUserItem>) => {
      if (data.userID === userID) {
        refetch();
      }
    };
    IMSDK.on(CbEvents.OnFriendAdded, friendAddedHandler);
    refreshData(
      props.cardInfo ? { cardInfo: props.cardInfo } : latestFullCardInfo.current,
    );
    return () => {
      IMSDK.off(CbEvents.OnFriendAdded, friendAddedHandler);
    };
  }, [isOverlayOpen, props.cardInfo]);

  const refreshSelfInfo = useCallback(() => {
    const latestInfo = useUserStore.getState().selfInfo;
    setCardInfo(latestInfo);
    setUserInfoRow(latestInfo);
  }, [isSelf]);

  const updateCardRemark = (remark: string) => {
    setUserInfoRow({ ...cardInfo!, remark });
  };
  const setUserInfoRow = (info: CardInfo) => {
    let tmpFields = [] as FieldRow[];
    tmpFields.push({
      title: t("placeholder.nickName"),
      value: info.nickname || "",
    });
    const isFriend = info?.remark !== undefined;

    if (isFriend) {
      tmpFields.push({
        title: t("placeholder.remark"),
        value: info.remark || "-",
        editable: true,
      });
    }
    if (isFriend || isSelf) {
      tmpFields = [
        ...tmpFields,
        ...[
          {
            title: t("placeholder.gender"),
            value: getGender(info.gender!),
          },
          {
            title: t("placeholder.birth"),
            value: info.birth ? dayjs(info.birth).format("YYYY/M/D") : "-",
          },
          {
            title: t("placeholder.phoneNumber"),
            value: info.phoneNumber || "-",
          },
          {
            title: t("placeholder.email"),
            value: info.email || "-",
          },
        ],
      ];
    }
    setUserFields(tmpFields);
  };

  const backToCard = () => {
    setIsSendRequest(false);
  };

  const trySendRequest = () => {
    setIsSendRequest(true);
  };

  const resetState = () => {
    setCardInfo(undefined);
    setUserFields([]);
    setIsSendRequest(false);
  };

  // Enterprise scenario: no mandatory friend-add mode; messaging is always allowed.
  const showAddFriend = false;

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={332}
      centered
      onCancel={closeOverlay}
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={resetState}
      ignoreClasses=".ignore-drag, .no-padding-modal, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <Spin spinning={isLoading}>
        {isSendRequest ? (
          <SendRequest cardInfo={cardInfo!} backToCard={backToCard} />
        ) : (
          <div className="flex max-h-[520px] min-h-[484px] flex-col overflow-hidden rounded-2xl bg-[var(--bg-base)] px-5.5 shadow-[0_8px_30px_rgba(31,35,41,0.12)]">
            <div className="flex h-[120px] min-h-[120px] w-full items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[#6d28d9] pt-4">
              <OIMAvatar
                size={64}
                src={cardInfo?.faceURL}
                text={cardInfo?.nickname}
                className="ring-4 ring-white/20"
              />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden px-2 -mt-6">
              <div className="flex items-center">
                <div className="ml-3 flex h-[60px] flex-1 flex-col justify-around overflow-hidden">
                  <div className="flex w-fit max-w-[80%] items-baseline">
                    <div
                      className="flex-1 select-text truncate text-lg font-semibold text-[var(--text-primary)]"
                      title={cardInfo?.nickname}
                    >
                      {cardInfo?.nickname}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div
                      className="mr-3 cursor-pointer text-xs text-[var(--text-tertiary)] hover:text-[var(--primary)]"
                      onClick={() => {
                        copyToClipboard(cardInfo?.userID ?? "");
                        feedbackToast({ msg: t("toast.copySuccess") });
                      }}
                    >
                      {cardInfo?.userID}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto rounded-xl bg-[var(--bg-body)] p-4">
                <UserCardDataGroup
                  title={t("placeholder.personalInfo")}
                  userID={cardInfo?.userID}
                  fieldRows={userFields}
                  updateCardRemark={updateCardRemark}
                />
              </div>
            </div>
            <div className="mx-2 mb-5 mt-3 flex items-center gap-3">
              {showAddFriend && (
                <Button type="primary" className="flex-1" onClick={trySendRequest}>
                  {t("placeholder.addFriends")}
                </Button>
              )}
              {isSelf && (
                <Button
                  type="primary"
                  className="flex-1"
                  onClick={() => editInfoRef.current?.openOverlay()}
                >
                  {t("placeholder.editInfo")}
                </Button>
              )}
              {!isSelf && (
                <Button
                  type="primary"
                  className="flex-1"
                  onClick={() =>
                    toSpecifiedConversation({
                      sourceID: userID!,
                      sessionType: SessionType.Single,
                    }).then(closeOverlay)
                  }
                >
                  {t("placeholder.sendMessage")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Spin>
      <EditSelfInfo ref={editInfoRef} refreshSelfInfo={refreshSelfInfo} />
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(UserCardModal));

interface IUserCardDataGroupProps {
  title: string;
  userID?: string;
  divider?: boolean;
  fieldRows: FieldRow[];
  updateCardRemark?: (remark: string) => void;
}

type FieldRow = {
  title: string;
  value: string;
  editable?: boolean;
};

const UserCardDataGroup: FC<IUserCardDataGroupProps> = ({
  title,
  userID,
  divider,
  fieldRows,
  updateCardRemark,
}) => {
  const tryUpdateRemark = async (remark: string) => {
    try {
      await IMSDK.updateFriends({
        friendUserIDs: [userID!],
        remark,
      });
      updateCardRemark?.(remark);
    } catch (error) {
      feedbackToast({ error });
    }
  };
  return (
    <div>
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-placeholder)]">
        {title}
      </div>
      {fieldRows.map((fieldRow, idx) => (
        <div
          className="flex items-center rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
          key={idx}
        >
          <div className="w-20 shrink-0 text-[var(--text-tertiary)]">
            {fieldRow.title}
          </div>
          {fieldRow.editable ? (
            <EditableContent
              className="!ml-0"
              textClassName="font-medium text-[var(--text-primary)]"
              value={fieldRow.value}
              editable={true}
              onChange={tryUpdateRemark}
            />
          ) : (
            <div className="flex-1 select-text truncate font-medium text-[var(--text-primary)]">
              {fieldRow.value}
            </div>
          )}
        </div>
      ))}

      {divider && <Divider className="my-2 border-[var(--border-color)]" />}
    </div>
  );
};
