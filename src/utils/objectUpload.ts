export const MAX_OBJECT_UPLOAD_FILE_SIZE = 200 * 1024 * 1024;

export const isObjectUploadFileSizeAllowed = (fileSize: number) =>
  Number.isFinite(fileSize) && fileSize <= MAX_OBJECT_UPLOAD_FILE_SIZE;

export const buildObjectUploadName = (userID: string | undefined, rawName: string) =>
  userID ? `${userID}/${rawName}` : rawName;
