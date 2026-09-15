type UnknownRecord = Record<string, unknown>;

const MAX_RESPONSE_LENGTH = 1024;
const RESPONSE_HEADER_NAMES = ["content-type", "server", "x-request-id"];

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const truncate = (value: string) => value.slice(0, MAX_RESPONSE_LENGTH);

const stringifyResponse = (value: unknown) => {
  if (typeof value === "string") return truncate(value);

  try {
    return truncate(JSON.stringify(value));
  } catch {
    return truncate(String(value));
  }
};

const getRecordMessage = (value: unknown) => {
  if (!isRecord(value)) return "";

  for (const key of ["errMsg", "errDlt", "message", "detail", "error"]) {
    const message = value[key];
    if (typeof message === "string" && message.trim()) return truncate(message.trim());
  }
  return "";
};

const getResponseHeaders = (value: unknown) => {
  if (!isRecord(value)) return undefined;

  const headers: Record<string, string> = {};
  for (const name of RESPONSE_HEADER_NAMES) {
    const header = value[name];
    if (typeof header === "string") headers[name] = header;
  }
  return Object.keys(headers).length ? headers : undefined;
};

export const getObjectUploadErrorDetails = (error: unknown) => {
  const record = isRecord(error) ? error : {};
  const response = isRecord(record.response) ? record.response : {};
  const responseHeaders = getResponseHeaders(response.headers);

  return {
    ...(typeof record.name === "string" ? { name: record.name } : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(typeof response.status === "number" ? { status: response.status } : {}),
    ...(typeof response.statusText === "string"
      ? { statusText: response.statusText }
      : {}),
    ...(response.data === undefined ? {} : { response: stringifyResponse(response.data) }),
    ...(responseHeaders ? { responseHeaders } : {}),
  };
};

export const getObjectUploadErrorMessage = (error: unknown) => {
  const record = isRecord(error) ? error : {};
  const response = isRecord(record.response) ? record.response : {};

  return (
    getRecordMessage(response.data) ||
    (typeof response.data === "string" ? truncate(response.data) : "") ||
    getRecordMessage(record) ||
    (typeof record.message === "string" ? truncate(record.message) : "") ||
    "Upload failed"
  );
};
