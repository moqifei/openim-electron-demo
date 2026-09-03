type DownloadFileNameOptions = {
  fileName?: string;
  contentDisposition?: string | null;
  url?: string;
  mimeType?: string;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const normalizeFileName = (value: string) => {
  const trimmed = value.trim().replace(/^(["'])(.*)\1$/, "$2");
  const segments = trimmed.split(/[\\/]/);
  return segments[segments.length - 1]?.trim() ?? "";
};

const isUsableFileName = (value: string) => {
  const normalized = normalizeFileName(value);
  return normalized !== "" && normalized.toLowerCase() !== "download";
};

const getContentDispositionFileName = (header: string | null | undefined) => {
  if (!header) return "";

  const encodedMatch = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(normalizeFileName(encodedMatch[1]));
      if (isUsableFileName(decoded)) return normalizeFileName(decoded);
    } catch {
      // Use the unencoded filename fallback below when decoding fails.
    }
  }

  const plainMatch = header.match(/filename\s*=\s*([^;]+)/i);
  return plainMatch?.[1] && isUsableFileName(plainMatch[1])
    ? normalizeFileName(plainMatch[1])
    : "";
};

const getUrlFileName = (url: string | undefined) => {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").pop() ?? "";
    const decoded = decodeURIComponent(segment);
    return isUsableFileName(decoded) ? normalizeFileName(decoded) : "";
  } catch {
    const withoutQuery = url.split(/[?#]/)[0];
    const segment = withoutQuery.split("/").pop() ?? "";
    return isUsableFileName(segment) ? normalizeFileName(segment) : "";
  }
};

const getMimeExtension = (mimeType: string | undefined) => {
  if (!mimeType) return "";
  return MIME_EXTENSIONS[mimeType.split(";", 1)[0].trim().toLowerCase()] ?? "";
};

export const getDownloadFileExtension = (fileName: string) => {
  const normalized = normalizeFileName(fileName);
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) return "";
  return normalized.slice(lastDot + 1).toLowerCase();
};

export const inferDownloadFileName = ({
  fileName,
  contentDisposition,
  url,
  mimeType,
}: DownloadFileNameOptions) => {
  const candidates = [
    fileName,
    getContentDispositionFileName(contentDisposition),
    getUrlFileName(url),
  ];
  const selected = candidates.find(
    (candidate) => candidate && isUsableFileName(candidate),
  );
  if (selected) {
    const normalized = normalizeFileName(selected);
    if (getDownloadFileExtension(normalized)) return normalized;
    const mimeExtension = getMimeExtension(mimeType);
    return mimeExtension ? `${normalized}.${mimeExtension}` : normalized;
  }

  const mimeExtension = getMimeExtension(mimeType);
  return mimeExtension ? `download.${mimeExtension}` : "download";
};

export const getDownloadFileFilters = (fileName: string) => {
  const extension = getDownloadFileExtension(fileName);
  if (!extension) return [{ name: "所有文件 (*.*)", extensions: ["*"] }];

  return [
    {
      name: `${extension.toUpperCase()} 文件 (*.${extension})`,
      extensions: [extension],
    },
    { name: "所有文件 (*.*)", extensions: ["*"] },
  ];
};
