import { t } from "i18next";

type ErrorRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ErrorRecord =>
  typeof value === "object" && value !== null;

const readText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
};

const readRecordMessage = (value: unknown) => {
  if (!isRecord(value)) return "";

  for (const key of ["errMsg", "errDlt", "message", "detail", "error"]) {
    const text = readText(value[key]) || readRecordMessage(value[key]);
    if (text) return text;
  }

  return "";
};

export const getFileTransferErrorReason = (error: unknown) => {
  const record = isRecord(error) ? error : undefined;
  const response = isRecord(record?.response) ? record.response : undefined;

  const candidates = [
    record?.errMsg,
    record?.errDlt,
    response?.data,
    record?.data,
    record?.message,
    record?.detail,
    record?.error,
    error,
  ];

  for (const candidate of candidates) {
    const text = readText(candidate) || readRecordMessage(candidate);
    if (text) return text;
  }

  const status = response?.status ?? record?.status;
  if (typeof status === "number" && status > 0) {
    return `HTTP ${status}`;
  }

  return "";
};

export const getFileTransferErrorMessage = (
  error: unknown,
  type: "upload" | "download",
) => {
  const reason = getFileTransferErrorReason(error);
  if (!reason) return t(`toast.${type}Failed`);

  return t(`toast.${type}FailedWithReason`, { reason });
};
