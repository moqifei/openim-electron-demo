import { Progress } from "antd";

import { notification } from "@/AntdGlobalComp";

type FileTransferStatus = "active" | "success" | "exception";

type FileTransferProgressOptions = {
  key: string;
  fileName: string;
  title: string;
  percent: number;
  status?: FileTransferStatus;
  onCancel?: () => void;
};

const clampPercent = (percent: number) => Math.min(100, Math.max(0, percent));

export const createFileTransferProgressKey = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const showFileTransferProgress = ({
  key,
  fileName,
  title,
  percent,
  status = "active",
  onCancel,
}: FileTransferProgressOptions) => {
  const safePercent = clampPercent(percent);

  notification.open({
    key,
    message: title,
    description: (
      <div className="min-w-[240px]">
        <div className="mb-2 truncate text-xs text-[var(--sub-text)]" title={fileName}>
          {fileName}
        </div>
        <Progress percent={safePercent} size="small" status={status} showInfo />
      </div>
    ),
    duration: status === "active" ? 0 : 1.5,
    onClose: status === "active" ? onCancel : undefined,
  });
};

export const closeFileTransferProgress = (key: string) => {
  notification.destroy(key);
};
