import { CloseOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Checkbox, Divider, Input, Modal } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  KeyboardEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { modal } from "@/AntdGlobalComp";
import i18n from "@/i18n";
import { useUserStore } from "@/store";
import { LocaleString } from "@/store/type";
import { feedbackToast } from "@/utils/common";

import { OverlayVisibleHandle, useOverlayVisible } from "../../hooks/useOverlayVisible";
import { IMSDK } from "../MainContentWrap";
import BlackList from "./BlackList";

const DEFAULT_SCREENSHOT_SHORTCUT = "CommandOrControl+Shift+X";

const isModifierKey = (key: string) =>
  ["Control", "Meta", "Alt", "Shift"].includes(key);

const getMainKey = (key: string) => {
  const keyMap: Record<string, string> = {
    " ": "Space",
    Escape: "Esc",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Insert: "Insert",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };

  if (keyMap[key]) return keyMap[key];
  if (/^[a-z]$/i.test(key) || /^\d$/.test(key)) return key.toUpperCase();
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase();
  return null;
};

const buildScreenshotShortcut = (event: KeyboardEvent<HTMLInputElement>) => {
  if (isModifierKey(event.key)) return null;

  const mainKey = getMainKey(event.key);
  if (!mainKey) return null;

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (!modifiers.length) return null;

  return `${modifiers.join("+")}+${mainKey}`;
};

const formatScreenshotShortcut = (shortcut: string) =>
  shortcut
    .split("+")
    .map((part) => {
      if (["CommandOrControl", "CmdOrCtrl"].includes(part)) return "Ctrl";
      return part;
    })
    .join(" + ");

const PersonalSettings: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      onCancel={closeOverlay}
      centered
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={360}
      className="no-padding-modal max-w-[70vw]"
      maskTransitionName=""
    >
      <PersonalSettingsContent closeOverlay={closeOverlay} />
    </Modal>
  );
};

export default memo(forwardRef(PersonalSettings));

export const PersonalSettingsContent = ({
  closeOverlay,
}: {
  closeOverlay?: () => void;
}) => {
  const localeStr = useUserStore((state) => state.appSettings.locale);
  const closeAction = useUserStore((state) => state.appSettings.closeAction);
  const updateAppSettings = useUserStore((state) => state.updateAppSettings);
  const [screenshotShortcut, setScreenshotShortcut] = useState(
    DEFAULT_SCREENSHOT_SHORTCUT,
  );
  const [downloadPath, setDownloadPath] = useState("");

  const backListRef = useRef<OverlayVisibleHandle>(null);

  const localeChange = (checked: boolean, locale: LocaleString) => {
    if (!checked) return;
    window.electronAPI?.ipcInvoke("changeLanguage", locale);
    i18n.changeLanguage(locale);
    updateAppSettings({
      locale,
    });
  };

  const closeActionChange = (checked: boolean, action: "miniSize" | "quit") => {
    if (checked) {
      window.electronAPI?.ipcInvoke("setKeyStore", {
        key: "closeAction",
        data: action,
      });
      updateAppSettings({
        closeAction: action,
      });
    }
  };

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI
      .ipcInvoke<unknown>("getKeyStore", { key: "screenshotShortcut" })
      .then((storedShortcut) => {
        if (typeof storedShortcut === "string" && storedShortcut.trim()) {
          setScreenshotShortcut(storedShortcut.trim());
        }
      });

    window.electronAPI
      .ipcInvoke<unknown>("getKeyStore", { key: "downloadPath" })
      .then((storedPath) => {
        if (typeof storedPath === "string" && storedPath.trim()) {
          setDownloadPath(storedPath.trim());
        }
      });
  }, []);

  const chooseDownloadPath = async () => {
    if (!window.electronAPI) return;
    const paths = await window.electronAPI.openFileDialog({
      properties: ["openDirectory"],
    });
    const nextPath = paths[0];
    if (!nextPath) return;
    await window.electronAPI.ipcInvoke("setKeyStore", {
      key: "downloadPath",
      data: nextPath,
    });
    setDownloadPath(nextPath);
    feedbackToast({ msg: t("toast.downloadPathSaved") });
  };

  const captureScreenshotShortcut = async (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isModifierKey(event.key)) return;

    const nextShortcut = buildScreenshotShortcut(event);
    if (!nextShortcut) {
      feedbackToast({ error: t("toast.screenshotShortcutInvalid") });
      return;
    }

    try {
      const result = await window.electronAPI?.ipcInvoke<{
        success: boolean;
        shortcut?: string;
        error?: "invalid" | "register-failed";
      }>("updateScreenshotShortcut", nextShortcut);

      if (!result?.success) {
        feedbackToast({
          error:
            result?.error === "invalid"
              ? t("toast.screenshotShortcutInvalid")
              : t("toast.screenshotShortcutConflict"),
        });
        return;
      }

      setScreenshotShortcut(result.shortcut ?? nextShortcut);
      feedbackToast({ msg: t("toast.screenshotShortcutSaved") });
    } catch (error) {
      feedbackToast({ error, msg: t("toast.screenshotShortcutConflict") });
    }
  };

  const toBlackList = () => {
    backListRef.current?.openOverlay();
  };

  return (
    <div className="flex flex-col bg-[var(--chat-bubble)]">
      <BlackList ref={backListRef} />
      <div className="app-drag flex items-center justify-between bg-[var(--gap-text)] p-5">
        <span className="text-base font-medium">{t("placeholder.accountSetting")}</span>
        <CloseOutlined
          className="app-no-drag cursor-pointer text-[#8e9aaf]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6">
          <div>
            <div className="pb-5 pt-4 text-base font-medium">
              {t("placeholder.personalSetting")}
            </div>
            <div className="pb-8 pl-1">
              <div className="pb-3 font-medium">{t("placeholder.chooseLanguage")}</div>
              <div>
                <Checkbox
                  checked={localeStr === "zh-CN"}
                  className="mr-4"
                  onChange={(e) => localeChange(e.target.checked, "zh-CN")}
                >
                  简体中文
                </Checkbox>
                <Checkbox
                  checked={localeStr === "en-US"}
                  onChange={(e) => localeChange(e.target.checked, "en-US")}
                >
                  English
                </Checkbox>
              </div>
            </div>
            {Boolean(window.electronAPI) && (
              <>
                <div className="pb-8 pl-1">
                  <div className="pb-3 font-medium">
                    {t("placeholder.closeButtonEvent")}
                  </div>
                  <div>
                    <Checkbox
                      checked={closeAction === "quit"}
                      className="mr-4"
                      onChange={(e) => closeActionChange(e.target.checked, "quit")}
                    >
                      {t("placeholder.exitApplication")}
                    </Checkbox>
                    <Checkbox
                      checked={closeAction === "miniSize"}
                      onChange={(e) => closeActionChange(e.target.checked, "miniSize")}
                    >
                      {t("placeholder.minimize")}
                    </Checkbox>
                  </div>
                </div>
                <div className="pb-8 pl-1">
                  <div className="pb-3 font-medium">
                    {t("placeholder.screenshotShortcut")}
                  </div>
                  <Input
                    readOnly
                    value={formatScreenshotShortcut(screenshotShortcut)}
                    onKeyDown={captureScreenshotShortcut}
                  />
                  <div className="pt-2 text-xs text-[var(--sub-text)]">
                    {t("placeholder.screenshotShortcutHint")}
                  </div>
                </div>
                <div className="pb-8 pl-1">
                  <div className="pb-3 font-medium">
                    {t("placeholder.downloadPath")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      readOnly
                      value={downloadPath}
                      placeholder={t("placeholder.systemDownloadPath")}
                    />
                    <Button onClick={() => void chooseDownloadPath()}>
                      {t("placeholder.chooseDownloadPath")}
                    </Button>
                  </div>
                  <div className="pt-2 text-xs text-[var(--sub-text)]">
                    {t("placeholder.downloadPathHint")}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <Divider className="m-0 border-4 border-[var(--gap-text)]" />
        <div
          className="flex cursor-pointer items-center justify-between px-6 py-4"
          onClick={toBlackList}
        >
          <div className="text-base font-medium">{t("placeholder.blackList")}</div>
          <RightOutlined rev={undefined} />
        </div>
        <Divider className="m-0 border-4 border-[var(--gap-text)]" />
      </div>
    </div>
  );
};
