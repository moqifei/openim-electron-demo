import { SettingOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Space } from "antd";
import { useState } from "react";

import { getServerHost, setServerHost, clearServerHost } from "@/utils/config";

interface ServerConfigProps {
  onConfigChanged?: () => void;
}

const ServerConfig = ({ onConfigChanged }: ServerConfigProps) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getServerHost());

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setServerHost(trimmed);
    setOpen(false);
    // Notify parent to reload / re-login
    onConfigChanged?.();
  };

  const handleReset = () => {
    clearServerHost();
    setValue(import.meta.env.VITE_BASE_HOST as string);
    setOpen(false);
    onConfigChanged?.();
  };

  return (
    <>
      <SettingOutlined
        className="cursor-pointer text-lg text-gray-400 hover:text-[var(--primary)]"
        onClick={() => {
          setValue(getServerHost());
          setOpen(true);
        }}
      />
      <Modal
        title="服务器地址配置"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={400}
        destroyOnClose
      >
        <div className="mb-4 text-xs text-gray-400">
          请输入 OpenIM 服务器的 IP 地址或域名（不含端口号）
        </div>
        <Input
          placeholder="例如: 192.168.1.100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={handleSave}
          autoFocus
        />
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>
            当前：{value}:10008
          </span>
          <Space>
            <Button size="small" type="link" danger onClick={handleReset}>
              恢复默认
            </Button>
            <Button size="small" type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        </div>
      </Modal>
    </>
  );
};

export default ServerConfig;
