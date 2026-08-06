import { t } from "i18next";

import { message } from "../AntdGlobalComp";

type FeedbackToastParams = {
  msg?: string | null;
  error?: unknown;
  duration?: number;
  onClose?: () => void;
};

interface FeedbackError extends Error {
  errMsg?: string;
  errDlt?: string;
}
export const feedbackToast = (config?: FeedbackToastParams) => {
  const { msg, error, duration, onClose } = config ?? {};
  let content = "";
  if (error) {
    content =
      (error as FeedbackError)?.message ??
      (error as FeedbackError)?.errMsg ??
      (error as FeedbackError)?.errDlt ??
      t("toast.accessFailed");
  }
  message.open({
    type: error ? "error" : "success",
    content: msg ?? content ?? t("toast.accessSuccess"),
    duration,
    onClose,
  });
  if (error) {
    console.error(msg, error);
  }
};

export const canSendImageTypeList = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];

export const bytesToSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = bytes / Math.pow(k, i);
  return `${size % 1 === 0 ? size : size.toFixed(2)} ${sizes[i]}`;
};

export const secondsToTime = (seconds: number) => {
  let minutes = 0; // min
  let hours = 0; // hour
  let days = 0; // day
  if (seconds > 60) {
    minutes = parseInt((seconds / 60) as unknown as string);
    seconds = parseInt((seconds % 60) as unknown as string);
    if (minutes > 60) {
      hours = parseInt((minutes / 60) as unknown as string);
      minutes = parseInt((minutes % 60) as unknown as string);
      if (hours > 24) {
        days = parseInt((hours / 24) as unknown as string);
        hours = parseInt((hours % 24) as unknown as string);
      }
    }
  }
  let result = "";
  if (seconds > 0) {
    result = t("date.second", { num: parseInt(seconds as unknown as string) });
  }
  if (minutes > 0) {
    result = t("date.minute", { num: parseInt(minutes as unknown as string) }) + result;
  }
  if (hours > 0) {
    result = t("date.hour", { num: parseInt(hours as unknown as string) }) + result;
  }
  if (days > 0) {
    result = t("date.day", { num: parseInt(days as unknown as string) }) + result;
  }
  return result;
};

export const secondsToMS = (duration: number) => {
  let minutes = Math.floor(duration / 60) % 60;
  let seconds = (duration % 60).toString();
  minutes = minutes.toString().padStart(2, "0") as unknown as number;
  seconds = seconds.length === 1 ? "0" + seconds : seconds;
  return `${minutes}:${seconds}`;
};

export const filterEmptyValue = (obj: Record<string, unknown>) => {
  for (const key in obj) {
    if (obj[key] === "") {
      delete obj[key];
    }
  }
};

export const checkIsSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent) &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

export const downloadFile = async (originUrl: string) => {
  const linkNode = document.createElement("a");
  linkNode.style.display = "none";
  const idx = originUrl.lastIndexOf("/");
  linkNode.download = originUrl.slice(idx + 1);
  linkNode.href = originUrl;
  document.body.appendChild(linkNode);
  linkNode.click();
  document.body.removeChild(linkNode);
};

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (evt) {
      const base64 = evt.target?.result;
      resolve(base64 as string);
    };
    reader.readAsDataURL(file);
  });

export const formatBr = (str: string) => str.replace(/\n/g, "<br>");

/**
 * Format an @-mention message text (OpenIM AtTextElem.text) into HTML.
 *
 * The most reliable source of the actual mention targets is `atUsersInfo`
 * (AtUsersInfoItem[] from AtTextElem.atUsersInfo), whose `groupNickname`
 * matches the token rendered in the text.
 *
 * We wrap every known `@nickname` token in a Feishu-style inline pill tag
 * (`<span class="atMentionTag">`) followed by a small circle dot that
 * indicates whether the mentioned user has read the message.
 * A legacy middle-dot (•, U+2022) suffix is tolerated and consumed.
 *
 * @param text              – raw text from AtTextElem.text (e.g. "@用户09 你好")
 * @param atUsersInfo       – AtUsersInfoItem[] from AtTextElem.atUsersInfo
 * @param hasReadUserIDList – current list of user IDs who have read this message;
 *                           when provided each dot is rendered as solid (●) for
 *                           read users and hollow (○) for unread ones.
 */
export const formatAtText = (
  text: string,
  atUsersInfo?: Array<{ atUserID: string; groupNickname: string }>,
  hasReadUserIDList?: string[],
): string => {
  // Escape HTML entities first to prevent XSS
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Collect the known mention nicknames and escape them for use in a regex.
  // Build a lookup map: groupNickname → atUserID so we can embed it as data.
  const nameToID = new Map<string, string>();
  const names = (atUsersInfo || [])
    .filter((u) => u?.groupNickname && u?.atUserID)
    .map((u) => {
      const escaped = u.groupNickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      nameToID.set(u.groupNickname, u.atUserID);
      return escaped;
    });

  // Primary: match exactly the nicknames we know were mentioned.
  if (names.length > 0) {
    const pattern = new RegExp(`@(${names.join("|")})•?`, "g");
    html = html.replace(pattern, (_match, nickname) => {
      const rawName =
        [...nameToID.keys()].find(
          (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") === nickname,
        ) ?? nickname;
      const uid = nameToID.get(rawName) || "";
      const isRead = hasReadUserIDList?.includes(uid) ?? false;
      const dotClass = isRead ? "atDot--read" : "atDot--unread";
      return `<span class="atMentionTag" data-at-user-id="${uid}">@${rawName}</span><span class="atDot ${dotClass}" data-at-user-id="${uid}"></span>`;
    });
  }

  // Fallback: legacy payloads without populated atUsersInfo.
  if (!html.includes("atMentionTag")) {
    html = html.replace(
      /@([^\s\u2022<>]+)\u2022?/g,
      '<span class="atMentionTag">$&</span>',
    );
  }

  // Convert newlines
  html = html.replace(/\n/g, "<br>");

  return html;
};

export const getFileType = (name: string) => {
  const idx = name.lastIndexOf(".");
  return name.slice(idx + 1);
};

export const generateAvatar = (str: string, size = 40) => {
  str = !str ? t("placeholder.unknown") : str.split("")[0];
  let colors = ["#0072E3"];
  let cvs = document.createElement("canvas");
  cvs.setAttribute("width", size as unknown as string);
  cvs.setAttribute("height", size as unknown as string);
  let ctx = cvs.getContext("2d");
  ctx!.fillStyle = colors[Math.floor(Math.random() * colors.length)];
  ctx!.fillRect(0, 0, size, size);
  ctx!.fillStyle = "rgb(255,255,255)";
  ctx!.font = size * 0.4 + "px Arial";
  ctx!.textBaseline = "middle";
  ctx!.textAlign = "center";
  ctx!.fillText(str, size / 2, size / 2);
  return cvs.toDataURL("image/png", 1);
};

export async function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
