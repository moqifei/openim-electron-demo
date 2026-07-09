import { MessageType } from "@openim/wasm-client-sdk";
import { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";

const localOrInlineUrlPattern = /^(data|blob|file):/i;
const windowsPathPattern = /^[a-zA-Z]:[\\/]/;
const windowsUncPathPattern = /^\\\\/;

export const isUploadedObjectURL = (url?: string) => {
  const value = url?.trim();
  if (!value) return false;

  return !(
    localOrInlineUrlPattern.test(value) ||
    windowsPathPattern.test(value) ||
    windowsUncPathPattern.test(value)
  );
};

export const isPreUploadedMediaMessage = (
  message: Pick<MessageItem, "contentType" | "pictureElem" | "fileElem">,
) => {
  if (message.contentType === MessageType.PictureMessage) {
    return isUploadedObjectURL(message.pictureElem?.sourcePicture?.url);
  }
  if (message.contentType === MessageType.FileMessage) {
    return isUploadedObjectURL(message.fileElem?.sourceUrl);
  }
  return false;
};
