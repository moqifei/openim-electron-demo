import { RightOutlined } from "@ant-design/icons";
import { Badge, Divider, Layout, Popover, Upload } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import React, { memo, useRef, useState } from "react";
import ImageResizer from "react-image-file-resizer";
import { UNSAFE_NavigationContext, useResolvedPath } from "react-router-dom";

import { modal } from "@/AntdGlobalComp";
import { updateBusinessUserInfo } from "@/api/login";
import change_avatar from "@/assets/images/profile/change_avatar.png";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { emit } from "@/utils/events";
import { uploadFile } from "@/utils/imCommon";

import { OverlayVisibleHandle } from "../../hooks/useOverlayVisible";
import About from "./About";
import styles from "./left-nav-bar.module.scss";
import { getMainNavItems, MainNavItem } from "./navItems";
import PersonalSettings from "./PersonalSettings";

const { Sider } = Layout;

const resizeFile = (file: File): Promise<File> =>
  new Promise((resolve) => {
    ImageResizer.imageFileResizer(
      file,
      400,
      400,
      "webp",
      90,
      0,
      (uri) => {
        resolve(uri as File);
      },
      "file",
    );
  });

const NavItem = ({ nav: { icon, icon_active, title, path } }: { nav: MainNavItem }) => {
  const resolvedPath = useResolvedPath(path);
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const toPathname = navigator.encodeLocation
    ? navigator.encodeLocation(path).pathname
    : resolvedPath.pathname;
  const locationPathname = location.pathname;
  const isActive =
    locationPathname === toPathname ||
    (locationPathname.startsWith(toPathname) &&
      locationPathname.charAt(toPathname.length) === "/") ||
    location.hash.startsWith(`#${toPathname}`);

  const unReadCount = useConversationStore((state) => state.unReadCount);
  const unHandleFriendApplicationCount = useContactStore(
    (state) => state.unHandleFriendApplicationCount,
  );
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );

  const tryNavigate = () => {
    if (isActive) return;
    navigator.push(path);
  };

  const getBadge = () => {
    if (path === "/chat") return unReadCount;
    if (path === "/contact")
      return unHandleFriendApplicationCount + unHandleGroupApplicationCount;
    return 0;
  };

  return (
    <Badge size="small" count={getBadge()}>
      <div
        className={clsx(
          "group flex h-[52px] w-12 cursor-pointer flex-col items-center justify-center rounded-xl transition-all duration-200",
          isActive
            ? "bg-[var(--primary-light)] text-[var(--primary)]"
            : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]",
        )}
        onClick={tryNavigate}
      >
        <img
          width={22}
          src={isActive ? icon_active : icon}
          alt=""
          className="opacity-90"
        />
        <div
          className={clsx(
            "mt-1 text-[11px] font-medium leading-none transition-colors",
            isActive ? "text-[var(--primary)]" : "text-[var(--text-tertiary)]",
          )}
        >
          {title}
        </div>
      </div>
    </Badge>
  );
};

const profileMenuList = [
  {
    title: t("placeholder.myInfo"),
    gap: true,
    idx: 0,
  },
  {
    title: t("placeholder.accountSetting"),
    gap: true,
    idx: 1,
  },
  {
    title: t("placeholder.about"),
    gap: false,
    idx: 2,
  },
  {
    title: t("placeholder.checkNewVersion"),
    gap: false,
    idx: 3,
  },
  {
    title: t("placeholder.logOut"),
    gap: false,
    idx: 4,
  },
];

i18n.on("languageChanged", () => {
  profileMenuList[0].title = t("placeholder.myInfo");
  profileMenuList[1].title = t("placeholder.accountSetting");
  profileMenuList[2].title = t("placeholder.about");
  profileMenuList[3].title = t("placeholder.checkNewVersion");
  profileMenuList[4].title = t("placeholder.logOut");
});

const LeftNavBar = memo(() => {
  const aboutRef = useRef<OverlayVisibleHandle>(null);
  const personalSettingsRef = useRef<OverlayVisibleHandle>(null);
  const [showProfile, setShowProfile] = useState(false);
  const selfInfo = useUserStore((state) => state.selfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  const navList = getMainNavItems({
    chatTitle: t("placeholder.chat"),
    contactTitle: t("placeholder.contact"),
  });

  const profileMenuClick = (idx: number) => {
    switch (idx) {
      case 0:
        emit("OPEN_USER_CARD", {
          isSelf: true,
          userID: useUserStore.getState().selfInfo.userID,
        });
        break;
      case 1:
        personalSettingsRef.current?.openOverlay();
        break;
      case 2:
        aboutRef.current?.openOverlay();
        break;
      case 3:
        void window.electronAPI
          ?.ipcInvoke("checkForUpdates")
          .catch((error: unknown) => {
            feedbackToast({ error });
          });
        break;
      case 4:
        tryLogout();
        break;
      default:
        break;
    }
    setShowProfile(false);
  };

  const tryLogout = () => {
    modal.confirm({
      title: t("placeholder.logOut"),
      content: t("toast.confirmlogOut"),
      onOk: async () => {
        try {
          await userLogout(false, true);
        } catch (error) {
          feedbackToast({ error });
        }
      },
    });
  };

  const customUpload = async ({ file }: { file: File }) => {
    const resizedFile = await resizeFile(file);
    const filePath = await window.electronAPI?.saveFileToDisk({
      sync: true,
      file,
    });

    try {
      const {
        data: { url },
      } = await uploadFile(resizedFile, filePath);
      const newInfo = {
        faceURL: url,
      };
      await updateBusinessUserInfo(newInfo);
      updateSelfInfo(newInfo);
    } catch (error) {
      feedbackToast({ error: t("toast.updateAvatarFailed") });
    }
  };

  const ProfileContent = (
    <div className="w-72 px-3 pb-4 pt-5">
      <div className="mb-5 flex items-center gap-3">
        <Upload
          accept=".jpeg,.png,.webp"
          showUploadList={false}
          customRequest={customUpload as any}
        >
          <div className={styles["avatar-wrapper"]}>
            <OIMAvatar src={selfInfo.faceURL} text={selfInfo.nickname} />
            <div className={styles["mask"]}>
              <img src={change_avatar} width={19} alt="" />
            </div>
          </div>
        </Upload>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
            {selfInfo.nickname}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
            ID: {selfInfo.userID}
          </div>
        </div>
      </div>
      {profileMenuList.map((menu) => (
        <div key={menu.idx}>
          <div
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-3 transition-colors hover:bg-[var(--bg-hover)]"
            onClick={() => profileMenuClick(menu.idx)}
          >
            <span className="text-sm text-[var(--text-secondary)]">{menu.title}</span>
            <RightOutlined
              rev={undefined}
              className="text-xs text-[var(--text-placeholder)]"
            />
          </div>
          {menu.gap && <Divider className="my-1 border-[var(--divider-color)]" />}
        </div>
      ))}
    </div>
  );

  return (
    <Sider
      className="no-mobile border-r border-[var(--border-color)] !bg-[var(--bg-sidebar)]"
      width={64}
      theme="light"
    >
      <div className="mt-5 flex flex-col items-center">
        <Popover
          content={ProfileContent}
          trigger="click"
          placement="rightBottom"
          overlayClassName="profile-popover"
          title={null}
          arrow={false}
          open={showProfile}
          onOpenChange={(vis) => setShowProfile(vis)}
        >
          <OIMAvatar
            className="mb-5 cursor-pointer shadow-sm ring-2 ring-transparent transition-shadow hover:shadow-md hover:ring-[var(--primary-light)]"
            src={selfInfo.faceURL}
            text={selfInfo.nickname}
          />
        </Popover>

        <div className="w-full space-y-1 px-2.5">
          {navList.map((nav) => (
            <NavItem nav={nav} key={nav.path} />
          ))}
        </div>
      </div>
      <PersonalSettings ref={personalSettingsRef} />
      <About ref={aboutRef} />
    </Sider>
  );
});

export default LeftNavBar;
