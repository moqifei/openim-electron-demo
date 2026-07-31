import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";

export const DIGITAL_TWIN_EXT_TYPE = "digital_twin";
export const DIGITAL_TWIN_EXT_TYPE_FIELD = "openim_ext_type";
export const DIGITAL_TWIN_TRACE_KEY = "openim_digital_twin_trace";
export const BOT_PLATFORM_ID = 12;

export type DigitalTwinTrace = {
  source?: string;
  protocolSource?: string;
  finalizeSource?: string;
  metadata?: Record<string, unknown>;
};

type PlainRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is PlainRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMaybeJSON = (value: unknown): unknown => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return undefined;
  }
};

const stringField = (record: PlainRecord | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
};

const getMessageRecordField = (message: MessageItem, field: string) => {
  return (message as unknown as PlainRecord)[field];
};

const numberField = (record: PlainRecord | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "number" ? value : undefined;
};

export const isBotPlatformMessage = (message: MessageItem) => {
  const record = message as unknown as PlainRecord;
  return numberField(record, "senderPlatformID") === BOT_PLATFORM_ID;
};

export const getDigitalTwinExt = (message: MessageItem) => {
  const parsed = parseMaybeJSON(getMessageRecordField(message, "ex"));
  return isRecord(parsed) ? parsed : undefined;
};

const extractTextFromRecord = (record: PlainRecord | undefined): string => {
  if (!record) return "";

  const directText =
    stringField(record, "content") ||
    stringField(record, "text") ||
    stringField(record, "replyText") ||
    stringField(record, "messageContent");
  if (directText) return directText;

  const textElem = record.textElem;
  if (isRecord(textElem)) {
    const textElemContent = stringField(textElem, "content");
    if (textElemContent) return textElemContent;
  }

  const markdownTextElem = record.markdownTextElem || record.markdownElem;
  if (isRecord(markdownTextElem)) {
    const markdownText = stringField(markdownTextElem, "content");
    if (markdownText) return markdownText;
  }

  const atTextElem = record.atTextElem;
  if (isRecord(atTextElem)) {
    const atText = stringField(atTextElem, "text");
    if (atText) return atText;
  }

  const customElem = record.customElem;
  if (isRecord(customElem)) {
    const customData = parseMaybeJSON(customElem.data);
    if (isRecord(customData)) return extractTextFromRecord(customData);
  }

  return "";
};

export const extractDigitalTwinText = (message: MessageItem) => {
  const textElem = getMessageRecordField(message, "textElem");
  if (isRecord(textElem)) {
    const content = stringField(textElem, "content");
    if (content) return content;
  }

  const markdownTextElem =
    getMessageRecordField(message, "markdownTextElem") ||
    getMessageRecordField(message, "markdownElem");
  if (isRecord(markdownTextElem)) {
    const content = stringField(markdownTextElem, "content");
    if (content) return content;
  }

  const rawContent = getMessageRecordField(message, "content");
  if (typeof rawContent === "string") {
    const trimmed = rawContent.trim();
    const parsed = parseMaybeJSON(trimmed);

    if (typeof parsed === "string") return parsed;
    if (isRecord(parsed)) {
      const parsedText = extractTextFromRecord(parsed);
      if (parsedText) return parsedText;
    }
    if (trimmed) return trimmed;
  }

  if (isRecord(rawContent)) {
    const contentText = extractTextFromRecord(rawContent);
    if (contentText) return contentText;
  }

  const ext = getDigitalTwinExt(message);
  const extReplyText = stringField(ext, "replyText");
  if (extReplyText) return extReplyText;

  return "";
};

export const getDigitalTwinTrace = (
  message: MessageItem,
): DigitalTwinTrace | undefined => {
  const ext = getDigitalTwinExt(message);
  const trace = ext?.[DIGITAL_TWIN_TRACE_KEY];

  return isRecord(trace) ? trace : undefined;
};

export type DigitalTwinCitation = {
  title?: string;
  spaceName?: string;
  relevanceScore?: number;
};

export const extractDigitalTwinCitations = (
  message: MessageItem,
): DigitalTwinCitation[] => {
  const ext = getDigitalTwinExt(message);
  const raw = ext?.["citations"];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((item) => ({
      title: stringField(item, "title"),
      spaceName: stringField(item, "spaceName"),
      relevanceScore: typeof item["relevanceScore"] === "number"
        ? (item["relevanceScore"] as number)
        : undefined,
    }))
    .filter((c) => c.title || c.spaceName);
};

export const isDigitalTwinMessage = (message: MessageItem) => {
  if (isBotPlatformMessage(message)) return false;

  const ext = getDigitalTwinExt(message);
  if (ext?.[DIGITAL_TWIN_EXT_TYPE_FIELD] === DIGITAL_TWIN_EXT_TYPE) return true;

  const parsedContent = parseMaybeJSON(getMessageRecordField(message, "content"));
  return (
    isRecord(parsedContent) &&
    parsedContent[DIGITAL_TWIN_EXT_TYPE_FIELD] === DIGITAL_TWIN_EXT_TYPE
  );
};
