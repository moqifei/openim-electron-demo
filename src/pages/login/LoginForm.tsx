import { Button, Form, Input, QRCode, Select, Space, Tabs } from "antd";
import { t } from "i18next";
import md5 from "md5";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useADLogin, useLogin, useSendSms } from "@/api/login";
import {
  getAdUsername,
  getEmail,
  getPhoneNumber,
  setAdUsername,
  setAreaCode,
  setEmail,
  setIMProfile,
  setPhoneNumber,
} from "@/utils/storage";

import { areaCode } from "./areaCode";
import type { FormType } from "./index";
import styles from "./index.module.scss";

export type LoginMethod = "phone" | "email" | "ad";

// 0login 1resetPassword 2register
enum LoginType {
  Password,
  VerifyCode,
}

type LoginFormProps = {
  loginMethod: LoginMethod;
  updateLoginMethod: (method: LoginMethod) => void;
};

const LoginForm = ({ loginMethod, updateLoginMethod }: LoginFormProps) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loginType, setLoginType] = useState<LoginType>(LoginType.Password);
  const { mutate: login, isLoading: loginLoading } = useLogin();
  const { mutate: adLogin, isLoading: adLoginLoading } = useADLogin();
  const { mutate: semdSms } = useSendSms();

  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prevCountdown) => prevCountdown - 1);
        if (countdown === 1) {
          clearTimeout(timer);
          setCountdown(0);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const onFinish = (params: any) => {
    if (loginMethod === "ad") {
      handleAdLogin(params);
      return;
    }
    if (loginType === 0) {
      params.password = md5(params.password ?? "");
    }
    if (params.phoneNumber) {
      setAreaCode(params.areaCode);
      setPhoneNumber(params.phoneNumber);
    }
    if (params.email) {
      setEmail(params.email);
    }
    login(params, {
      onSuccess: (data) => {
        const { chatToken, imToken, userID } = data.data;
        setIMProfile({ chatToken, imToken, userID });
        navigate("/chat");
      },
    });
  };

  const handleAdLogin = (params: { username: string; password: string }) => {
    setAdUsername(params.username);
    adLogin(
      { username: params.username, password: params.password },
      {
        onSuccess: (data) => {
          const { chatToken, imToken, userID } = data.data;
          setIMProfile({ chatToken, imToken, userID });
          navigate("/chat");
        },
      },
    );
  };

  const sendSmsHandle = () => {
    const options = {
      phoneNumber: form.getFieldValue("phoneNumber"),
      email: form.getFieldValue("email"),
      areaCode: form.getFieldValue("areaCode"),
      usedFor: 3,
    };
    if (loginMethod === "phone") {
      delete options.email;
    }
    if (loginMethod === "email") {
      delete options.phoneNumber;
      delete options.areaCode;
    }

    semdSms(options, {
      onSuccess() {
        setCountdown(60);
      },
    });
  };

  const onLoginMethodChange = (key: string) => {
    updateLoginMethod(key as LoginMethod);
  };

  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div className="text-xl font-medium">{t("placeholder.welcome")}</div>
      </div>
      <Tabs
        className={styles["login-method-tab"]}
        activeKey="ad"
        items={[{ key: "ad", label: t("placeholder.adLogin") }]}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
        labelCol={{ prefixCls: "custom-form-item" }}
        initialValues={{
          username: getAdUsername(),
        }}
      >
        <Form.Item
          label={t("placeholder.adUsername")}
          name="username"
          rules={[{ required: true, message: t("placeholder.inputAdUsername") }]}
        >
          <Input allowClear placeholder={t("placeholder.inputAdUsername")} />
        </Form.Item>
        <Form.Item
          label={t("placeholder.password")}
          name="password"
          rules={[{ required: true, message: t("placeholder.inputAdPassword") }]}
        >
          <Input.Password allowClear placeholder={t("placeholder.inputAdPassword")} />
        </Form.Item>
        <Form.Item className="mb-4 mt-10">
          <Button type="primary" htmlType="submit" block loading={adLoginLoading}>
            {t("placeholder.login")}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
};

export default LoginForm;
