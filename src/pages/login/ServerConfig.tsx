import { SettingOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Space } from "antd";
import { useState } from "react";

import {
  clearServerHost,
  getChatHost,
  getIMHost,
  getOrangeUrl,
  getPlazaUrl,
  setManualServerHosts,
  setOrangeUrl,
  setPlazaUrl,
} from "@/utils/config";

interface ServerConfigProps {
  onConfigChanged?: () => void;
}

const ServerConfig = ({ onConfigChanged }: ServerConfigProps) => {
  const [open, setOpen] = useState(false);
  const [imHost, setImHost] = useState(getIMHost());
  const [chatHost, setChatHostVal] = useState(getChatHost());
  const [orangeUrl, setOrangeUrlVal] = useState(getOrangeUrl());
  const [plazaUrl, setPlazaUrlVal] = useState(getPlazaUrl());

  const handleSave = () => {
    const trimmedIm = imHost.trim();
    const trimmedChat = chatHost.trim();
    if (!trimmedIm || !trimmedChat) return;
    setManualServerHosts({ imHost: trimmedIm, chatHost: trimmedChat });
    // 留空则交回自动解析（启动时按所选环境派生）
    setOrangeUrl(orangeUrl.trim());
    setPlazaUrl(plazaUrl.trim());
    setOpen(false);
    onConfigChanged?.();
  };

  const handleReset = () => {
    clearServerHost();
    const defaultIm = (import.meta.env.VITE_IM_HOST ??
      import.meta.env.VITE_BASE_HOST) as string;
    const defaultChat = (import.meta.env.VITE_CHAT_HOST ??
      import.meta.env.VITE_BASE_HOST) as string;
    setImHost(defaultIm);
    setChatHostVal(defaultChat);
    setOrangeUrlVal(getOrangeUrl());
    setPlazaUrlVal(getPlazaUrl());
    setOpen(false);
    onConfigChanged?.();
  };

  return (
    <>
      <SettingOutlined
        className="cursor-pointer text-lg text-gray-400 hover:text-[var(--primary)]"
        onClick={() => {
          setImHost(getIMHost());
          setChatHostVal(getChatHost());
          setOrangeUrlVal(getOrangeUrl());
          setPlazaUrlVal(getPlazaUrl());
          setOpen(true);
        }}
      />
      <Modal
        title="服务器地址配置"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={440}
        destroyOnClose
      >
        <div className="mb-3 text-xs text-gray-400">
          集群部署模式下，IM 服务和 Chat 服务可能部署在不同地址
        </div>
        <div className="mb-2">
          <div className="mb-1 text-sm font-medium">IM 服务器地址</div>
          <div className="mb-1 text-xs text-gray-400">
            WebSocket :20001 / API :10002（历史版本兼容 :10001）
          </div>
          <Input
            placeholder="例如: 192.168.1.100"
            value={imHost}
            onChange={(e) => setImHost(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mb-3">
          <div className="mb-1 text-sm font-medium">Chat 服务器地址</div>
          <div className="mb-1 text-xs text-gray-400">API :10008</div>
          <Input
            placeholder="例如: 192.168.1.200"
            value={chatHost}
            onChange={(e) => setChatHostVal(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <div className="mb-1 text-sm font-medium">Orange 地址</div>
          <div className="mb-1 text-xs text-gray-400">
            分身技能直连安装地址，留空则按所选环境自动解析
          </div>
          <Input
            placeholder="例如: http://orange:3000"
            value={orangeUrl}
            onChange={(e) => setOrangeUrlVal(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <div className="mb-1 text-sm font-medium">技能广场地址</div>
          <div className="mb-1 text-xs text-gray-400">
            技能广场地址，留空则按所选环境自动解析
          </div>
          <Input
            placeholder="例如: http://llm-tools.oa.bx"
            value={plazaUrl}
            onChange={(e) => setPlazaUrlVal(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            当前：IM {imHost}:20001/02 | Chat {chatHost}:10008
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
