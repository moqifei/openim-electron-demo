import { Button, Form, Input, Tabs } from "antd";
import { t } from "i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useADLogin } from "@/api/login";
import { ensureServerEnvironmentSelected } from "@/utils/serverEnvironment";
import { getAdUsername, setAdUsername, setIMProfile } from "@/utils/storage";

import styles from "./index.module.scss";

type AdLoginFormValues = {
  username: string;
  password: string;
};

const LoginForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectingServer, setSelectingServer] = useState(false);
  const { mutateAsync: adLogin, isLoading: adLoginLoading } = useADLogin();

  const onFinish = (params: AdLoginFormValues) => {
    // Always use AD login (phone/email removed)
    void handleAdLogin(params);
  };

  const handleAdLogin = async (params: AdLoginFormValues) => {
    setAdUsername(params.username);
    setSelectingServer(true);
    try {
      await ensureServerEnvironmentSelected(true);
      const data = await adLogin({
        username: params.username,
        password: params.password,
      });
      const { chatToken, imToken, userID } = data.data;
      setIMProfile({ chatToken, imToken, userID });
      navigate("/chat");
    } finally {
      setSelectingServer(false);
    }
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
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={selectingServer || adLoginLoading}
          >
            {t("placeholder.login")}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
};

export default LoginForm;
