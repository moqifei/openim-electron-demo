import { t } from "i18next";
import { useCallback, useState } from "react";

import login_bg from "@/assets/images/login/login_bg.png";
import WindowControlBar from "@/components/WindowControlBar";
import { getLoginMethod, setLoginMethod as saveLoginMethod } from "@/utils/storage";

import styles from "./index.module.scss";
import LoginForm from "./LoginForm";
import type { LoginMethod } from "./LoginForm";

export const Login = () => {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(
    getLoginMethod() as LoginMethod,
  );

  const updateLoginMethod = useCallback((method: LoginMethod) => {
    setLoginMethod(method);
    saveLoginMethod(method);
  }, []);

  return (
    <div className="relative flex h-full flex-col">
      <div className="app-drag relative h-10 bg-[var(--top-search-bar)]">
        <WindowControlBar />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <LeftBar />
        <div
          className={`${styles.login} mr-14 h-[450px] w-[350px] rounded-md p-11`}
          style={{ boxShadow: "0 0 30px rgba(0,0,0,.1)" }}
        >
          <LoginForm
            loginMethod={loginMethod}
            updateLoginMethod={updateLoginMethod}
          />
        </div>
      </div>
    </div>
  );
};

const LeftBar = () => {
  return (
    <div className="flex min-h-[420]">
      <div className="mr-14 text-center">
        <div className="text-2xl">{t("placeholder.title")}</div>
        <span className="text-sm  text-gray-400">{t("placeholder.subTitle")}</span>
        <img src={login_bg} alt="login_bg" />
      </div>
    </div>
  );
};
