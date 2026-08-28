export const buildObjectUploadName = (userID: string | undefined, rawName: string) =>
  userID ? `${userID}/${rawName}` : rawName;

export const shouldUseNativeObjectUpload = (
  filePath?: string,
  canUseNativeBridge = typeof window !== "undefined" &&
    Boolean(window.electronAPI?.ipcInvoke),
) => Boolean(filePath?.trim() && canUseNativeBridge);
