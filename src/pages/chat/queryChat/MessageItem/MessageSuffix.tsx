import { CheckCircleFilled, ExclamationCircleFilled, LoadingOutlined } from "@ant-design/icons";
import { MessageStatus, MessageType } from "@openim/wasm-client-sdk";
import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Popover, Spin } from "antd";
import { t } from "i18next";
import { FC, useEffect, useMemo, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { IMSDK } from "@/layout/MainContentWrap";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const MessageSuffix: FC<IMessageItemProps> = ({ message, isSender }) => {
  const [showSending, setShowSending] = useState(false);
  const [showReadStatus, setShowReadStatus] = useState(false);
  const [readPopoverOpen, setReadPopoverOpen] = useState(false);
  const [readMembers, setReadMembers] = useState<GroupMemberItem[]>([]);
  const [readMembersLoading, setReadMembersLoading] = useState(false);

  const groupHasReadInfo = message.attachedInfoElem?.groupHasReadInfo;
  const hasReadUserIDList = useMemo(
    () => groupHasReadInfo?.hasReadUserIDList ?? [],
    [groupHasReadInfo?.hasReadUserIDList],
  );

  useEffect(() => {
    if (message.status !== MessageStatus.Sending) return;
    const timer = setTimeout(() => {
      if (message.status === MessageStatus.Sending) {
        setShowSending(true);
      }
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [message.status]);

  // 发送方才显示已读状态
  useEffect(() => {
    if (!isSender || message.status !== MessageStatus.Succeed) {
      setShowReadStatus(false);
      return;
    }
    // 单聊消息：根据 isRead 字段显示
    if (message.sessionType === 1) {
      setShowReadStatus(true);
    }
    // 群聊消息：根据 groupHasReadInfo 显示（包括普通群和工作群）
    const isGroup = message.sessionType === 2 || message.sessionType === 3;
    if (isGroup && groupHasReadInfo) {
      setShowReadStatus(true);
    }
  }, [isSender, message.status, message.sessionType, message.isRead, groupHasReadInfo]);

  useEffect(() => {
    if (!readPopoverOpen || hasReadUserIDList.length === 0 || !message.groupID) {
      setReadMembers([]);
      return;
    }

    let ignore = false;
    setReadMembersLoading(true);
    IMSDK.getSpecifiedGroupMembersInfo({
      groupID: message.groupID,
      userIDList: hasReadUserIDList,
    }).then(({ data }) => {
      if (!ignore) {
        setReadMembers(data ?? []);
      }
    }).catch((err) => {
      console.error("[read] failed to fetch group read members:", err);
      if (!ignore) {
        setReadMembers([]);
      }
    }).finally(() => {
      if (!ignore) {
        setReadMembersLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [readPopoverOpen, hasReadUserIDList, message.groupID]);

  // 获取已读状态文本
  const getReadStatusText = (): string => {
    // 单聊
    if (message.sessionType === 1) {
      return message.isRead ? t("placeholder.isRead") : t("placeholder.unread");
    }
    // 群聊（包括普通群和工作群）
    const isGroup = message.sessionType === 2 || message.sessionType === 3;
    if (isGroup && groupHasReadInfo) {
      const { hasReadCount = 0, groupMemberCount = 0, unreadCount = 0 } = groupHasReadInfo;
      const readCount = hasReadCount || 0;
      const totalCount = Math.max(groupMemberCount > 0 ? groupMemberCount - 1 : readCount + unreadCount, 0);
      if (totalCount === 0) return "";
      if (readCount >= totalCount && totalCount > 0) return t("placeholder.isRead");
      if (readCount > 0) return `${readCount}/${totalCount}`;
      return t("placeholder.unread");
    }
    return "";
  };

  const readStatusText = getReadStatusText();
  const isGroupReadStatus = (message.sessionType === 2 || message.sessionType === 3) && Boolean(groupHasReadInfo);

  const readMembersContent = (
    <div className={styles.readMemberPopover}>
      <div className={styles.readMemberTitle}>已读成员</div>
      {readMembersLoading ? (
        <div className={styles.readMemberEmpty}>
          <Spin size="small" />
        </div>
      ) : readMembers.length > 0 ? (
        <div className={styles.readMemberList}>
          {readMembers.map((member) => (
            <div className={styles.readMemberItem} key={member.userID}>
              <OIMAvatar size={28} src={member.faceURL} text={member.nickname || member.userID} />
              <span className={styles.readMemberName}>{member.nickname || member.userID}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.readMemberEmpty}>暂无成员</div>
      )}
    </div>
  );

  const readStatusNode = (
    <span className={styles.readStatus}>
      {message.isRead || (message.sessionType === 3 && readStatusText === "已读") ? (
        <CheckCircleFilled className="text-[10px] text-[var(--success-text)]" />
      ) : (
        <span className="text-[10px] text-[var(--sub-text)]" />
      )}
      <span className="text-[10px] text-[var(--sub-text)] ml-0.5">{readStatusText}</span>
    </span>
  );

  return (
    <div className={styles.suffix}>
      {showSending && message.status === MessageStatus.Sending && (
        <Spin
          className="flex"
          indicator={<LoadingOutlined style={{ fontSize: 16 }} spin rev={undefined} />}
        />
      )}
      {message.status === MessageStatus.Failed && (
        <ExclamationCircleFilled
          className="text-base text-[var(--warn-text)]"
          rev={undefined}
        />
      )}
      {showReadStatus && readStatusText && message.status === MessageStatus.Succeed && (
        isGroupReadStatus ? (
          <Popover
            content={readMembersContent}
            open={readPopoverOpen}
            onOpenChange={setReadPopoverOpen}
            placement="left"
            trigger="click"
          >
            <button className={styles.readStatusButton} type="button">
              {readStatusNode}
            </button>
          </Popover>
        ) : readStatusNode
      )}
    </div>
  );
};

export default MessageSuffix;
