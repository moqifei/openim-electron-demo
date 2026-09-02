import { CbEvents, LogLevel } from "@openim/wasm-client-sdk";
import { MessageType, SessionType } from "@openim/wasm-client-sdk";
import {
  BlackUserItem,
  ConversationItem,
  FriendApplicationItem,
  FriendUserItem,
  GroupApplicationItem,
  GroupItem,
  GroupMemberItem,
  GroupMessageReceiptInfo,
  MessageItem,
  ReceiptInfo,
  RevokedInfo,
  SelfUserInfo,
  WSEvent,
  WsResponse,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { CustomType } from "@/constants";
import { SystemMessageTypes } from "@/constants/im";
import {
  pushNewMessage,
  updateOneMessage,
} from "@/pages/chat/queryChat/useHistoryMessageList";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/common";
import { getIMHost, getIMWsPort } from "@/utils/config";
import { isConversationDoNotDisturb } from "@/utils/conversationNotification";
import emitter from "@/utils/events";
import {
  getConversationContent,
  getConversationIDByMsg,
  initStore,
} from "@/utils/imCommon";
import { initReadVisibilityMonitor } from "@/utils/readVisibility";
import { canAutoMarkConversationAsRead } from "@/utils/readVisibility";
import { ensureServerEnvironmentSelected } from "@/utils/serverEnvironment";
import { canUseShake, isShakeMessageData } from "@/utils/shakeMessage";
import { clearIMProfile, getIMToken, getIMUserID } from "@/utils/storage";

import { IMSDK } from "./MainContentWrap";

/**
 * 解析 IM WebSocket 端口，兼容端口迁移：
 * - 优先使用用户/环境变量配置（默认 20001，行内标准化端口）；
 * - 在 Electron 环境下，通过主进程 TCP 探测候选端口 [20001, 10001]，
 *   返回第一个可达端口；若探测失败则回退到配置端口（保证老服务端 10001 仍可用）。
 */
const IM_WS_PORT_CANDIDATES = [20001, 10001];
const PROBE_IM_WS_PORT_CHANNEL = "probeImWsPort";
const SHAKE_DURATION_MS = 1000;

const resolveImWsPort = async (host: string): Promise<string> => {
  const configured = getIMWsPort();
  if (window.electronAPI) {
    try {
      const detected = await window.electronAPI.ipcInvoke<number | null>(
        PROBE_IM_WS_PORT_CHANNEL,
        { host, ports: IM_WS_PORT_CANDIDATES, timeoutMs: 1500 },
      );
      if (detected) return String(detected);
    } catch (error) {
      console.warn("[ws] probe im ws port failed, fallback to configured", error);
    }
  }
  return configured;
};

export function useGlobalEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const resume = useRef(false);
  const isMessagePageOpenRef = useRef(false);
  isMessagePageOpenRef.current = location.pathname.startsWith("/chat/");

  // user
  const updateSyncState = useUserStore((state) => state.updateSyncState);
  const updateProgressState = useUserStore((state) => state.updateProgressState);
  const updateReinstallState = useUserStore((state) => state.updateReinstallState);
  const updateIsLogining = useUserStore((state) => state.updateIsLogining);
  const updateConnectState = useUserStore((state) => state.updateConnectState);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  // conversation
  const updateConversationList = useConversationStore(
    (state) => state.updateConversationList,
  );
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const updateUnReadCount = useConversationStore((state) => state.updateUnReadCount);
  const updateCurrentGroupInfo = useConversationStore(
    (state) => state.updateCurrentGroupInfo,
  );
  const getCurrentGroupInfoByReq = useConversationStore(
    (state) => state.getCurrentGroupInfoByReq,
  );
  const setCurrentMemberInGroup = useConversationStore(
    (state) => state.setCurrentMemberInGroup,
  );
  const getCurrentMemberInGroupByReq = useConversationStore(
    (state) => state.getCurrentMemberInGroupByReq,
  );
  const tryUpdateCurrentMemberInGroup = useConversationStore(
    (state) => state.tryUpdateCurrentMemberInGroup,
  );
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );
  const getUnReadCountByReq = useConversationStore(
    (state) => state.getUnReadCountByReq,
  );
  // contact
  const getFriendListByReq = useContactStore((state) => state.getFriendListByReq);
  const getGroupListByReq = useContactStore((state) => state.getGroupListByReq);
  const updateFriend = useContactStore((state) => state.updateFriend);
  const pushNewFriend = useContactStore((state) => state.pushNewFriend);
  const updateBlack = useContactStore((state) => state.updateBlack);
  const pushNewBlack = useContactStore((state) => state.pushNewBlack);
  const updateGroup = useContactStore((state) => state.updateGroup);
  const pushNewGroup = useContactStore((state) => state.pushNewGroup);
  const updateRecvFriendApplication = useContactStore(
    (state) => state.updateRecvFriendApplication,
  );
  const updateSendFriendApplication = useContactStore(
    (state) => state.updateSendFriendApplication,
  );
  const updateRecvGroupApplication = useContactStore(
    (state) => state.updateRecvGroupApplication,
  );
  const updateSendGroupApplication = useContactStore(
    (state) => state.updateSendGroupApplication,
  );

  useEffect(() => {
    initReadVisibilityMonitor();
    loginCheck();
    setIMListener();
    setIpcListener();

    window.addEventListener("online", () => {
      IMSDK.networkStatusChanged();
    });
    window.addEventListener("offline", () => {
      IMSDK.networkStatusChanged();
    });
    return () => {
      disposeIMListener();
    };
  }, []);

  const loginCheck = async () => {
    const IMToken = (await getIMToken()) as string;
    const IMUserID = (await getIMUserID()) as string;
    if (!IMToken || !IMUserID) {
      clearIMProfile();
      navigate("/login");
      return;
    }
    tryLogin();
  };

  const tryLogin = async () => {
    updateIsLogining(true);
    const IMToken = (await getIMToken()) as string;
    const IMUserID = (await getIMUserID()) as string;
    try {
      await ensureServerEnvironmentSelected(true);
      const host = getIMHost();
      const apiAddr = `http://${host}:10002`;
      // WS 端口迁移兼容：优先探测 20001（行内标准化端口），不可达则回退 10001（遗留端口）
      const wsPort = await resolveImWsPort(host);
      const wsAddr = `ws://${host}:${wsPort}`;
      if (window.electronAPI) {
        await IMSDK.initSDK({
          platformID: window.electronAPI?.getPlatform() ?? 5,
          apiAddr,
          wsAddr,
          dataDir: window.electronAPI.getDataPath("sdkResources") || "./",
          logFilePath: window.electronAPI.getDataPath("logsPath") || "./",
          logLevel: LogLevel.Debug,
          isLogStandardOutput: false,
          systemType: "electron",
        });
        await IMSDK.login({
          userID: IMUserID,
          token: IMToken,
        });
      } else {
        await IMSDK.login({
          userID: IMUserID,
          token: IMToken,
          platformID: 5,
          apiAddr,
          wsAddr,
          logLevel: LogLevel.Debug,
        });
      }
      initStore();
    } catch (error) {
      console.error(error);
      if ((error as WsResponse).errCode !== 10102) {
        navigate("/login");
      }
    }
    updateIsLogining(false);
  };

  const setIMListener = () => {
    // account
    IMSDK.on(CbEvents.OnSelfInfoUpdated, selfUpdateHandler);
    IMSDK.on(CbEvents.OnConnecting, connectingHandler);
    IMSDK.on(CbEvents.OnConnectFailed, connectFailedHandler);
    IMSDK.on(CbEvents.OnConnectSuccess, connectSuccessHandler);
    IMSDK.on(CbEvents.OnKickedOffline, kickHandler);
    IMSDK.on(CbEvents.OnUserTokenExpired, expiredHandler);
    IMSDK.on(CbEvents.OnUserTokenInvalid, expiredHandler);
    // sync
    IMSDK.on(CbEvents.OnSyncServerStart, syncStartHandler);
    IMSDK.on(CbEvents.OnSyncServerProgress, syncProgressHandler);
    IMSDK.on(CbEvents.OnSyncServerFinish, syncFinishHandler);
    IMSDK.on(CbEvents.OnSyncServerFailed, syncFailedHandler);
    // message
    IMSDK.on(CbEvents.OnRecvNewMessages, newMessageHandler);
    IMSDK.on(CbEvents.OnNewRecvMessageRevoked, revokedMessageHandler);
    IMSDK.on(CbEvents.OnRecvC2CReadReceipt, c2cReadReceiptHandler);
    IMSDK.on(CbEvents.OnRecvGroupReadReceipt, groupReadReceiptHandler);
    // conversation
    IMSDK.on(CbEvents.OnConversationChanged, conversationChnageHandler);
    IMSDK.on(CbEvents.OnNewConversation, newConversationHandler);
    IMSDK.on(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler);
    // friend
    IMSDK.on(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler);
    IMSDK.on(CbEvents.OnFriendAdded, friednAddedHandler);
    IMSDK.on(CbEvents.OnFriendDeleted, friednDeletedHandler);
    // blacklist
    IMSDK.on(CbEvents.OnBlackAdded, blackAddedHandler);
    IMSDK.on(CbEvents.OnBlackDeleted, blackDeletedHandler);
    // group
    IMSDK.on(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler);
    IMSDK.on(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler);
    IMSDK.on(CbEvents.OnGroupDismissed, joinedGroupDismissHandler);
    IMSDK.on(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler);
    IMSDK.on(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler);
    IMSDK.on(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler);
    IMSDK.on(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler);
    // application
    IMSDK.on(CbEvents.OnFriendApplicationAdded, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationAdded, groupApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler);
    IMSDK.on(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler);
  };

  const selfUpdateHandler = ({ data }: WSEvent<SelfUserInfo>) => {
    updateSelfInfo(data);
  };
  const connectingHandler = () => {
    updateConnectState("loading");
    console.log("connecting...");
  };
  const connectFailedHandler = ({ errCode, errMsg }: WSEvent) => {
    updateConnectState("failed");
    console.error("connectFailedHandler", errCode, errMsg);

    if (errCode === 705) {
      tryOut(t("toast.loginExpiration"));
    }
  };
  const connectSuccessHandler = () => {
    updateConnectState("success");
    console.log("connect success...");
    // 断连恢复后主动重新拉取会话与消息,防止 server 重启/订阅失效导致收不到推送。
    // 每次触发最多产生 2 个幂等 HTTP 请求(getConversationListByReq + getUnReadCountByReq),
    // RELOAD_CHAT_MESSAGES 为纯前端事件,不产生网络请求。不会形成请求风暴。
    getConversationListByReq(false);
    getUnReadCountByReq();
    emitter.emit("RELOAD_CHAT_MESSAGES");
  };
  const kickHandler = () => tryOut(t("toast.accountKicked"));
  const expiredHandler = () => tryOut(t("toast.loginExpiration"));

  const tryOut = (msg: string) =>
    feedbackToast({
      msg,
      error: msg,
      onClose: () => {
        userLogout(true);
      },
    });

  // sync
  const syncStartHandler = ({ data }: WSEvent<boolean>) => {
    console.log("[sync] OnSyncServerStart, reinstall:", data);
    updateSyncState("loading");
    updateReinstallState(data);
  };
  const syncProgressHandler = ({ data }: WSEvent<number>) => {
    console.log("[sync] OnSyncServerProgress, progress:", data);
    updateProgressState(data);
  };
  const syncFinishHandler = () => {
    console.log("[sync] OnSyncServerFinish");
    updateSyncState("success");
    getFriendListByReq();
    getGroupListByReq();
    getConversationListByReq(false);
    getUnReadCountByReq();
    emitter.emit("RELOAD_CHAT_MESSAGES");
    console.log("[sync] RELOAD_CHAT_MESSAGES emitted");
  };
  const syncFailedHandler = () => {
    console.log("[sync] OnSyncServerFailed");
    updateSyncState("failed");
    feedbackToast({ msg: t("toast.syncFailed"), error: t("toast.syncFailed") });
  };

  // message
  const newMessageHandler = ({ data }: WSEvent<MessageItem[]>) => {
    console.log(
      "[msg] OnRecvNewMessages, count:",
      data.length,
      "syncState:",
      useUserStore.getState().syncState,
      "resume:",
      resume.current,
      "msgs:",
      data.map((m) => ({
        seq: m.seq,
        convID: m.conversationID || m.clientMsgID?.substring(0, 8),
        contentType: m.contentType,
        content: typeof m.content === "string" ? m.content.substring(0, 20) : "",
      })),
    );
    if (useUserStore.getState().syncState === "loading" || resume.current) {
      // During sync, still process messages for the currently open conversation
      // so they appear in the chat window immediately.
      data.forEach((message) => {
        if (inCurrentConversation(message)) {
          console.log(
            "[msg] processing in-current-conversation msg during sync/resume, seq:",
            message.seq,
          );
          handleNewMessage(message);
        } else {
          console.log(
            "[msg] skipping non-current-conversation msg during sync/resume, seq:",
            message.seq,
          );
        }
      });
      return;
    }
    data.map((message) => {
      console.log(
        "[msg] processing new message, seq:",
        message.seq,
        "inCurrent:",
        inCurrentConversation(message),
      );
      handleNewMessage(message);
      notifyIncomingMessage(message);
    });
  };

  const revokedMessageHandler = ({ data }: WSEvent<RevokedInfo>) => {
    updateOneMessage({
      clientMsgID: data.clientMsgID,
      contentType: MessageType.RevokeMessage,
      notificationElem: {
        detail: JSON.stringify(data),
      },
    } as MessageItem);
  };

  const notPushType = [MessageType.TypingMessage, MessageType.RevokeMessage];

  const getConversationFromMessage = async (message: MessageItem) => {
    const conversationID = getConversationIDByMsg(message);
    const conversation = useConversationStore
      .getState()
      .conversationList.find((item) => item.conversationID === conversationID);
    if (conversation) return conversation;

    const isGroupMessage =
      message.sessionType === SessionType.Group ||
      message.sessionType === SessionType.WorkingGroup;
    const sourceID = isGroupMessage
      ? message.groupID
      : message.sendID === useUserStore.getState().selfInfo.userID
      ? message.recvID
      : message.sendID;
    if (!sourceID) return undefined;

    try {
      const { data } = await IMSDK.getOneConversation({
        sourceID,
        sessionType: message.sessionType,
      });
      return data;
    } catch (error) {
      console.warn("[shake] get conversation failed", error);
      return undefined;
    }
  };

  const handleShakeMessage = async (message: MessageItem) => {
    const conversation = await getConversationFromMessage(message);
    if (!conversation || !canUseShake(conversation, message)) return;
    if (isConversationDoNotDisturb(conversation)) return;

    await window.electronAPI?.ipcInvoke("showMainWindow");
    await updateCurrentConversation({ ...conversation });
    navigate(`/chat/${conversation.conversationID}`);
    window.electronAPI?.ipcSend("trayConversationOpened", {
      conversationID: conversation.conversationID,
    });
    window.electronAPI?.ipcSend("shakeMainWindow", {
      durationMs: SHAKE_DURATION_MS,
    });
  };

  const handleNewMessage = (newServerMsg: MessageItem) => {
    if (newServerMsg.contentType === MessageType.CustomMessage) {
      let customData: { customType?: number } = {};
      try {
        customData = JSON.parse(newServerMsg.customElem?.data || "{}");
      } catch {
        customData = {};
      }
      if (
        typeof customData.customType === "number" &&
        CustomType.CallingInvite <= customData.customType &&
        customData.customType <= CustomType.CallingHungup
      ) {
        return;
      }
      if (
        isShakeMessageData(newServerMsg.customElem?.data) &&
        newServerMsg.sendID !== useUserStore.getState().selfInfo.userID
      ) {
        void handleShakeMessage(newServerMsg);
      }
    }

    if (!inCurrentConversation(newServerMsg)) return;

    if (!notPushType.includes(newServerMsg.contentType)) {
      pushNewMessage(newServerMsg);
    }
  };

  const notifyIncomingMessage = (message: MessageItem) => {
    if (useUserStore.getState().syncState === "loading" || resume.current) {
      return;
    }
    if (message.sendID === useUserStore.getState().selfInfo.userID) return;
    if (SystemMessageTypes.includes(message.contentType)) return;
    if (isMessagePageOpenRef.current && canAutoMarkConversationAsRead()) return;

    const messageConversationID = getConversationIDByMsg(message);
    const currentConversationID =
      useConversationStore.getState().currentConversation?.conversationID;
    const shouldNotify =
      !canAutoMarkConversationAsRead() ||
      (messageConversationID && messageConversationID !== currentConversationID);

    if (!shouldNotify) return;

    const conversation = useConversationStore
      .getState()
      .conversationList.find((item) => item.conversationID === messageConversationID);
    if (conversation && isConversationDoNotDisturb(conversation)) return;
    const title =
      conversation?.showName ||
      (message.sessionType === SessionType.Group ||
      message.sessionType === SessionType.WorkingGroup
        ? message.groupID
        : message.senderNickname) ||
      "消息";
    const body = getConversationContent(message) || "";

    window.electronAPI?.ipcSend("requestMainWindowAttention");
    window.electronAPI?.ipcSend("notifyIncomingMessage", {
      conversationID: messageConversationID,
      title,
      body,
    });
  };

  const inCurrentConversation = (newServerMsg: MessageItem) => {
    switch (newServerMsg.sessionType) {
      case SessionType.Single:
        return (
          newServerMsg.sendID ===
            useConversationStore.getState().currentConversation?.userID ||
          (newServerMsg.sendID === useUserStore.getState().selfInfo.userID &&
            newServerMsg.recvID ===
              useConversationStore.getState().currentConversation?.userID)
        );
      case SessionType.Group:
      case SessionType.WorkingGroup:
        return (
          newServerMsg.groupID ===
          useConversationStore.getState().currentConversation?.groupID
        );
      case SessionType.Notification:
        return (
          newServerMsg.sendID ===
          useConversationStore.getState().currentConversation?.userID
        );
      default:
        return false;
    }
  };

  // conversation
  const conversationChnageHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    console.log(
      "[conv] OnConversationChanged, count:",
      data.length,
      "convs:",
      data.map((c) => ({
        convID: c.conversationID,
        unread: c.unreadCount,
        latestMsg: c.latestMsg?.substring(0, 20),
      })),
    );
    updateConversationList(data, "filter");
  };
  const newConversationHandler = ({ data }: WSEvent<ConversationItem[]>) => {
    console.log(
      "[conv] OnNewConversation, count:",
      data.length,
      "convs:",
      data.map((c) => ({ convID: c.conversationID, unread: c.unreadCount })),
    );
    updateConversationList(data, "push");
  };
  const totalUnreadChangeHandler = ({ data }: WSEvent<number>) => {
    console.log(
      "[conv] OnTotalUnreadMessageCountChanged, count:",
      data,
      "current:",
      useConversationStore.getState().unReadCount,
    );
    if (data === useConversationStore.getState().unReadCount) return;
    updateUnReadCount(data);
  };

  // friend
  const friednInfoChangeHandler = ({ data }: WSEvent<FriendUserItem>) => {
    updateFriend(data);
  };
  const friednAddedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    pushNewFriend(data);
  };
  const friednDeletedHandler = ({ data }: WSEvent<FriendUserItem>) => {
    updateFriend(data, true);
  };

  // blacklist
  const blackAddedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    pushNewBlack(data);
  };
  const blackDeletedHandler = ({ data }: WSEvent<BlackUserItem>) => {
    IMSDK.getSpecifiedFriendsInfo({
      friendUserIDList: [data.userID],
    }).then(({ data }) => {
      if (data.length) {
        pushNewFriend(data[0]);
      }
    });
    updateBlack(data, true);
  };

  // group
  const joinedGroupAddedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      updateCurrentGroupInfo(data);
      getCurrentMemberInGroupByReq(data.groupID);
    }
    pushNewGroup(data);
  };
  const joinedGroupDeletedHandler = ({ data }: WSEvent<GroupItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      getCurrentGroupInfoByReq(data.groupID);
      setCurrentMemberInGroup();
    }
    updateGroup(data, true);
  };
  const joinedGroupDismissHandler = ({ data }: WSEvent<GroupItem>) => {
    updateGroup(data);
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupInfoChangedHandler = ({ data }: WSEvent<GroupItem>) => {
    updateGroup(data);
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      updateCurrentGroupInfo(data);
    }
  };
  const groupMemberAddedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (
      data.groupID === useConversationStore.getState().currentConversation?.groupID &&
      data.userID === useUserStore.getState().selfInfo.userID
    ) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupMemberDeletedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (
      data.groupID === useConversationStore.getState().currentConversation?.groupID &&
      data.userID === useUserStore.getState().selfInfo.userID
    ) {
      getCurrentMemberInGroupByReq(data.groupID);
    }
  };
  const groupMemberInfoChangedHandler = ({ data }: WSEvent<GroupMemberItem>) => {
    if (data.groupID === useConversationStore.getState().currentConversation?.groupID) {
      tryUpdateCurrentMemberInGroup(data);
    }
  };

  //application
  const friendApplicationProcessedHandler = ({
    data,
  }: WSEvent<FriendApplicationItem>) => {
    const isRecv = data.toUserID === useUserStore.getState().selfInfo.userID;
    if (isRecv) {
      updateRecvFriendApplication(data);
    } else {
      updateSendFriendApplication(data);
    }
  };
  const groupApplicationProcessedHandler = ({
    data,
  }: WSEvent<GroupApplicationItem>) => {
    const isRecv = data.userID !== useUserStore.getState().selfInfo.userID;
    if (isRecv) {
      updateRecvGroupApplication(data);
    } else {
      updateSendGroupApplication(data);
    }
  };

  // 单聊已读回执处理
  const c2cReadReceiptHandler = ({ data }: WSEvent<ReceiptInfo[]>) => {
    console.log("[read] OnRecvC2CReadReceipt, receipts:", data.length, data);
    data.forEach((receipt) => {
      console.log(
        "[read] processing c2c receipt: userID:",
        receipt.userID,
        "msgIDList:",
        receipt.msgIDList,
      );
      // 直接从本地消息列表更新，不需要调用 getMsgsInfo
      // 因为 receipt 中的 msgIDList 就是已读的消息 ID 列表
      // 我们通过 emitter 通知所有聊天页面更新这些消息的 isRead 状态
      receipt.msgIDList.forEach((clientMsgID) => {
        updateOneMessage({
          clientMsgID,
          isRead: true,
        } as MessageItem);
      });
    });
  };

  // 群聊已读回执处理
  const groupReadReceiptHandler = ({ data }: WSEvent<GroupMessageReceiptInfo>) => {
    const readInfos = data?.groupMessageReadInfo ?? [];
    console.log(
      "[read] OnRecvGroupReadReceipt, conversationID:",
      data?.conversationID,
      "receipts:",
      readInfos.length,
    );
    readInfos.forEach((receipt) => {
      console.log(
        "[read] processing group receipt: clientMsgID:",
        receipt.clientMsgID,
        "hasReadCount:",
        receipt.hasReadCount,
        "unreadCount:",
        receipt.unreadCount,
      );
      updateOneMessage({
        clientMsgID: receipt.clientMsgID,
        attachedInfoElem: {
          groupHasReadInfo: {
            hasReadCount: receipt.hasReadCount,
            unreadCount: receipt.unreadCount,
            hasReadUserIDList:
              receipt.readMembers?.map((member) => member.userID) ?? [],
            groupMemberCount: receipt.hasReadCount + receipt.unreadCount + 1,
          },
        },
      } as MessageItem);
    });
  };

  const disposeIMListener = () => {
    IMSDK.off(CbEvents.OnSelfInfoUpdated, selfUpdateHandler);
    IMSDK.off(CbEvents.OnConnecting, connectingHandler);
    IMSDK.off(CbEvents.OnConnectFailed, connectFailedHandler);
    IMSDK.off(CbEvents.OnConnectSuccess, connectSuccessHandler);
    IMSDK.off(CbEvents.OnKickedOffline, kickHandler);
    IMSDK.off(CbEvents.OnUserTokenExpired, expiredHandler);
    IMSDK.off(CbEvents.OnUserTokenInvalid, expiredHandler);
    // sync
    IMSDK.off(CbEvents.OnSyncServerStart, syncStartHandler);
    IMSDK.off(CbEvents.OnSyncServerProgress, syncProgressHandler);
    IMSDK.off(CbEvents.OnSyncServerFinish, syncFinishHandler);
    IMSDK.off(CbEvents.OnSyncServerFailed, syncFailedHandler);
    // message
    IMSDK.off(CbEvents.OnRecvNewMessages, newMessageHandler);
    IMSDK.off(CbEvents.OnNewRecvMessageRevoked, revokedMessageHandler);
    IMSDK.off(CbEvents.OnRecvC2CReadReceipt, c2cReadReceiptHandler);
    IMSDK.off(CbEvents.OnRecvGroupReadReceipt, groupReadReceiptHandler);
    // conversation
    IMSDK.off(CbEvents.OnConversationChanged, conversationChnageHandler);
    IMSDK.off(CbEvents.OnNewConversation, newConversationHandler);
    IMSDK.off(CbEvents.OnTotalUnreadMessageCountChanged, totalUnreadChangeHandler);
    // friend
    IMSDK.off(CbEvents.OnFriendInfoChanged, friednInfoChangeHandler);
    IMSDK.off(CbEvents.OnFriendAdded, friednAddedHandler);
    IMSDK.off(CbEvents.OnFriendDeleted, friednDeletedHandler);
    // blacklist
    IMSDK.off(CbEvents.OnBlackAdded, blackAddedHandler);
    IMSDK.off(CbEvents.OnBlackDeleted, blackDeletedHandler);
    // group
    IMSDK.off(CbEvents.OnJoinedGroupAdded, joinedGroupAddedHandler);
    IMSDK.off(CbEvents.OnJoinedGroupDeleted, joinedGroupDeletedHandler);
    IMSDK.off(CbEvents.OnGroupDismissed, joinedGroupDismissHandler);
    IMSDK.off(CbEvents.OnGroupInfoChanged, groupInfoChangedHandler);
    IMSDK.off(CbEvents.OnGroupMemberAdded, groupMemberAddedHandler);
    IMSDK.off(CbEvents.OnGroupMemberDeleted, groupMemberDeletedHandler);
    IMSDK.off(CbEvents.OnGroupMemberInfoChanged, groupMemberInfoChangedHandler);
    // application
    IMSDK.off(CbEvents.OnFriendApplicationAdded, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnFriendApplicationAccepted, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnFriendApplicationRejected, friendApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationAdded, groupApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationAccepted, groupApplicationProcessedHandler);
    IMSDK.off(CbEvents.OnGroupApplicationRejected, groupApplicationProcessedHandler);
  };

  const setIpcListener = () => {
    window.electronAPI?.subscribe("appResume", () => {
      if (resume.current) {
        return;
      }
      resume.current = true;
      setTimeout(() => {
        resume.current = false;
      }, 5000);
    });

    window.electronAPI?.subscribe(
      "openConversationFromTray",
      async ({ conversationID }: { conversationID?: string }) => {
        if (!conversationID) return;
        const conversation = useConversationStore
          .getState()
          .conversationList.find((item) => item.conversationID === conversationID);
        if (!conversation) return;
        await updateCurrentConversation({ ...conversation });
        navigate(`/chat/${conversationID}`);
        window.electronAPI?.ipcSend("trayConversationOpened", { conversationID });
      },
    );

    // 主进程在退出软件前请求执行 OpenIM 退出登录（清理登录态，防止下次自动登录）
    window.electronAPI?.subscribe("requestLogoutBeforeQuit", async () => {
      try {
        // force=true: 直接清理本地登录态（token/locale），不再依赖 SDK 在线登出
        await userLogout(true);
      } catch (e) {
        console.error("[logout] before quit failed:", e);
      } finally {
        // 无论成功与否，通知主进程可以继续退出
        window.electronAPI?.ipcSend("requestLogoutBeforeQuit:done");
      }
    });
  };
}
