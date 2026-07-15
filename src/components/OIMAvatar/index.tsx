import { Avatar as AntdAvatar, AvatarProps } from "antd";
import clsx from "clsx";
import * as React from "react";
import { useMemo } from "react";

import { avatarList, getDefaultAvatar } from "@/utils/avatar";

/** 群组默认头像：多人剪影 SVG（作为 data URI 传入 src，确保与图片头像尺寸一致） */
const GROUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
  <circle cx="20" cy="20" r="20" fill="url(#g)"/>
  <circle cx="15" cy="15" r="3.5" fill="white" opacity="0.9"/>
  <path d="M8 28c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
  <circle cx="26" cy="16" r="3" fill="white" opacity="0.75"/>
  <path d="M20 29c0-3.31 2.69-6 6-6 2.9 0 5.32 2.06 5.88 4.8" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
</svg>`;
const GROUP_DEFAULT_SRC = `data:image/svg+xml,${encodeURIComponent(GROUP_SVG)}`;

const default_avatars = avatarList.map((item) => item.name);

interface IOIMAvatarProps extends AvatarProps {
  text?: string;
  color?: string;
  bgColor?: string;
  isgroup?: boolean;
  isnotification?: boolean;
  size?: number;
}

const OIMAvatar: React.FC<IOIMAvatarProps> = (props) => {
  const {
    src,
    text,
    size = 40,
    color = "#fff",
    bgColor = "#0289FA",
    isgroup = false,
    isnotification,
  } = props;
  const [errorHolder, setErrorHolder] = React.useState<string>();

  const getAvatarUrl = useMemo(() => {
    if (src) {
      if (default_avatars.includes(src as string))
        return getDefaultAvatar(src as string);

      return src;
    }
    return undefined;
  }, [src, isgroup, isnotification]);

  /** 群组是否应使用默认 SVG 图标（无 src 或 src 加载失败） */
  const useGroupDefaultIcon = useMemo(() => {
    return isgroup && (!src || !!errorHolder);
  }, [isgroup, src, errorHolder]);

  const avatarProps = { ...props, isgroup: undefined, isnotification: undefined };

  React.useEffect(() => {
    if (!isgroup) {
      setErrorHolder(undefined);
    }
  }, [isgroup]);

  const errorHandler = () => {
    if (isgroup) {
      setErrorHolder("__group_default__");
    }
  };

  // 群组默认图标统一走 src（data URI），与图片头像尺寸约束一致
  const finalSrc = useGroupDefaultIcon
    ? GROUP_DEFAULT_SRC
    : errorHolder === "__group_default__"
      ? GROUP_DEFAULT_SRC
      : errorHolder ?? getAvatarUrl;

  return (
    <AntdAvatar
      style={{
        backgroundColor: useGroupDefaultIcon ? "transparent" : bgColor,
        width: `${size}px`,
        height: `${size}px`,
        lineHeight: `${size - 2}px`,
        color,
        overflow: "hidden",
      }}
      shape="circle"
      {...avatarProps}
      className={clsx(
        {
          "cursor-pointer": Boolean(props.onClick),
        },
        props.className,
      )}
      src={finalSrc}
      onError={errorHandler as any}
    >
      {useGroupDefaultIcon ? null : text}
    </AntdAvatar>
  );
};

export default OIMAvatar;
