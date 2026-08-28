import { useMount } from "ahooks";
import { Layout, Spin } from "antd";
import { t } from "i18next";
import { useEffect, useRef, useState } from "react";
import { Outlet, useMatches, useNavigate } from "react-router-dom";

import { useUserStore } from "@/store";

import LeftNavBar from "./LeftNavBar";
import TopSearchBar from "./TopSearchBar";
import { useGlobalEvent } from "./useGlobalEvents";

export const MainContentLayout = () => {
  useGlobalEvent();
  const matches = useMatches();
  const navigate = useNavigate();
  const [isWindowShaking, setIsWindowShaking] = useState(false);
  const shakeResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.subscribe(
      "shakeMainWindowEffect",
      (durationMs?: number) => {
        const duration =
          typeof durationMs === "number" && durationMs > 0 ? durationMs : 1000;
        if (shakeResetTimer.current !== null) {
          window.clearTimeout(shakeResetTimer.current);
        }
        setIsWindowShaking(false);
        window.requestAnimationFrame(() => setIsWindowShaking(true));
        shakeResetTimer.current = window.setTimeout(() => {
          setIsWindowShaking(false);
          shakeResetTimer.current = null;
        }, duration);
      },
    );

    return () => {
      unsubscribe?.();
      if (shakeResetTimer.current !== null) {
        window.clearTimeout(shakeResetTimer.current);
      }
    };
  }, []);

  const progress = useUserStore((state) => state.progress);
  const syncState = useUserStore((state) => state.syncState);
  const reinstall = useUserStore((state) => state.reinstall);
  const isLogining = useUserStore((state) => state.isLogining);

  useMount(() => {
    const isRoot = !matches.find((item) => item.pathname !== "/");
    const inConversation = matches.some((item) => item.params.conversationID);
    if (isRoot || inConversation) {
      navigate("chat", {
        replace: true,
      });
    }
  });

  const loadingTip = isLogining ? t("toast.loading") : `${progress}%`;
  const showLockLoading = isLogining || (reinstall && syncState === "loading");

  return (
    <Spin className="!max-h-none" spinning={showLockLoading} tip={loadingTip}>
      <Layout className={`h-full${isWindowShaking ? " desktop-window-shake" : ""}`}>
        <TopSearchBar />
        <Layout>
          <LeftNavBar />
          <Outlet />
        </Layout>
      </Layout>
    </Spin>
  );
};
