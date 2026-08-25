import { CbEvents } from "@openim/wasm-client-sdk";
import { SessionType } from "@openim/wasm-client-sdk";
import {
  FriendUserItem,
  GroupMemberItem,
  WSEvent,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { useLatest } from "ahooks";
import { Button, Divider, Spin } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "i18next";
import i18n from "@/i18n";
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
import { searchADMembers, getADDepartmentList } from "@/api/organization";
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

    // Fetch AD department info for the user
    // Use account/username as keyword (same as SearchUserOrGroup component)
    try {
      const account = (userInfo as any)?.account || userInfo?.nickname || userID;
      console.log("[UserCard] fetching AD department, keyword:", account);
      const { data: adData } = await searchADMembers({
        keyword: account,
        pagination: { pageNumber: 1, showNumber: 5 },
      });
      const adMember = adData.members?.[0];
      console.log("[UserCard] AD search result:", JSON.stringify({
        total: adData.total,
        membersCount: adData.members?.length ?? 0,
        member: adMember ? {
          userID: adMember.userID,
          username: adMember.username,
          nickname: adMember.nickname,
          displayName: adMember.displayName,
          departmentName: adMember.departmentName,
          departmentID: adMember.departmentID,
        } : null,
      }, null, 2));

      if (adMember) {
        // Priority 1: AD returned departmentName directly
        if (adMember.departmentName) {
          userInfo = { ...userInfo, departmentName: adMember.departmentName };
          console.log("[UserCard] set departmentName (from AD field):", userInfo.departmentName);
        } else if (adMember.departmentID) {
          // Priority 2: Parse from LDAP DN (ou=部门名,...)
          const dnMatch = adMember.departmentID.match(/ou=([^,]+)/i);
          if (dnMatch?.[1]) {
            userInfo = { ...userInfo, departmentName: dnMatch[1] };
            console.log("[UserCard] set departmentName (from DN parse):", userInfo.departmentName);
          } else {
            // Priority 3: Fallback to getADDepartmentList lookup
            try {
              console.log("[UserCard] DN parse failed, trying getADDepartmentList");
              const { data: deptData } = await getADDepartmentList();
              const dept = deptData.departments?.find(
                (d) => d.departmentID === adMember.departmentID,
              );
              if (dept?.name) {
                userInfo = { ...userInfo, departmentName: dept.name };
                console.log("[UserCard] set departmentName (from dept list):", userInfo.departmentName);
              }
            } catch (deptErr) {
              console.warn("[UserCard] getADDepartmentList failed", deptErr);
            }
          }
        }
      }

      // If still no departmentName and we haven't tried nickname yet
      if (!userInfo.departmentName && userInfo?.nickname && userInfo.nickname !== account) {
        const { data: adData2 } = await searchADMembers({
          keyword: userInfo.nickname,
          pagination: { pageNumber: 1, showNumber: 5 },
        });
        const adMember2 = adData2.members?.[0];
        if (adMember2?.departmentName) {
          userInfo = { ...userInfo, departmentName: adMember2.departmentName };
          console.log("[UserCard] set departmentName (via nickname):", userInfo.departmentName);
        } else if (adMember2?.departmentID) {
          const dnMatch2 = adMember2.departmentID.match(/ou=([^,]+)/i);
          if (dnMatch2?.[1]) {
            userInfo = { ...userInfo, departmentName: dnMatch2[1] };
            console.log("[UserCard] set departmentName (via nickname + DN):", userInfo.departmentName);
          }
        }
      }

      if (!userInfo.departmentName) {
        console.warn("[UserCard] no department found after all attempts. account:", account, "nickname:", userInfo?.nickname);
      }
    } catch (error) {
      console.warn("fetch AD department info failed", userID, error);
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
    // Department from AD (show if available)
    if (info.departmentName) {
      tmpFields.push({
        title: i18n.language?.startsWith("zh") ? "部门" : "Department",
        value: info.departmentName,
      });
    }
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
          <div className="flex max-h-[540px] min-h-[500px] flex-col overflow-hidden rounded-2xl bg-[var(--bg-base)] shadow-[0_8px_30px_rgba(31,35,41,0.12)]">
            {/* Header with avatar */}
            <div className="relative flex h-[130px] min-h-[130px] w-full items-center justify-center bg-gradient-to-br from-[var(--primary)] via-[#7c3aed] to-[#6d28d9] pt-2">
              <OIMAvatar
                size={72}
                src={cardInfo?.faceURL}
                text={cardInfo?.nickname}
                className="ring-4 ring-white/25 shadow-lg"
              />
            </div>
            {/* Name + userID — overlaps header bottom */}
            <div className="flex flex-1 flex-col overflow-hidden px-5 -mt-7">
              <div className="flex items-center mb-1">
                <div className="ml-2 flex h-[56px] flex-1 flex-col justify-center overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm px-4 shadow-sm">
                  <div className="flex w-fit max-w-[85%] items-baseline gap-2">
                    <div
                      className="select-text truncate text-lg font-bold text-[var(--text-primary)] leading-tight"
                      title={cardInfo?.nickname}
                    >
                      {cardInfo?.nickname}
                    </div>
                  </div>
                  <div className="flex items-center mt-0.5">
                    <div
                      className="cursor-pointer text-[11px] text-[var(--text-tertiary)] hover:text-[var(--primary)] transition-colors"
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
              {/* Info fields */}
              <div className="flex-1 overflow-y-auto rounded-xl bg-[var(--bg-body)] p-4 mt-3">
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
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-[var(--border-color)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
          {title}
        </span>
        <div className="h-px flex-1 bg-[var(--border-color)]" />
      </div>
      <div className="space-y-1">
        {fieldRows.map((fieldRow, idx) => {
          const isDepartment = fieldRow.title === "部门" || fieldRow.title === "Department";
          return (
            <div
              className={`group flex items-center rounded-xl px-3.5 py-2.5 text-[13px] transition-all ${
                isDepartment
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 hover:from-blue-100/80 hover:to-indigo-100/60"
                  : "hover:bg-[var(--bg-hover)]"
              }`}
              key={idx}
            >
              <div
                className={`w-[72px] shrink-0 ${
                  isDepartment
                    ? "font-medium text-[var(--primary)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
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
                <div className="flex-1 select-text font-medium text-[var(--text-primary)] break-all leading-relaxed">
                  {isDepartment && (
                    <span className="mr-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[10px]">
                      <ApartmentOutlined style={{ fontSize: 10 }} />
                    </span>
                  )}
                  {fieldRow.value}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {divider && <Divider className="my-2 border-[var(--border-color)]" />}
    </div>
  );
};
