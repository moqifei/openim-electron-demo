export const MAX_OBJECT_UPLOAD_FILE_SIZE = 200 * 1024 * 1024;

export const isObjectUploadFileSizeAllowed = (fileSize: number) =>
  Number.isFinite(fileSize) && fileSize <= MAX_OBJECT_UPLOAD_FILE_SIZE;

export const buildObjectUploadName = (userID: string | undefined, rawName: string) =>
  userID ? `${userID}/${rawName}` : rawName;

export const shouldUseNativeObjectUpload = (
  filePath?: string,
  canUseNativeBridge = typeof window !== "undefined" &&
    Boolean(window.electronAPI?.ipcInvoke),
) => Boolean(filePath?.trim() && canUseNativeBridge);

export const shouldFallbackFromNativeObjectUpload = (response: {
  errCode?: number;
  errMsg?: string;
}) =>
  response.errCode === -1 &&
  response.errMsg?.includes("parse multipart form failed: unexpected EOF");
