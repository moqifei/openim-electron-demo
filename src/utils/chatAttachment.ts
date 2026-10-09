export const dataUrlToImageFile = (
  dataUrl: string,
  name = `image-${Date.now()}.png`,
) => {
  const [header, payload] = dataUrl.split(",", 2);
  const mime = header?.match(/^data:([^;]+);base64$/)?.[1] ?? "image/png";
  const binary = atob(payload ?? "");
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new File([bytes], name, { type: mime });
};

export const makeUniqueUploadFileName = (fileName: string, suffix: string) => {
  const cleanSuffix = suffix.trim();
  if (!cleanSuffix) return fileName;

  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return `${fileName}-${cleanSuffix}`;
  }

  const baseName = fileName.slice(0, lastDotIndex);
  const extension = fileName.slice(lastDotIndex);
  return `${baseName}-${cleanSuffix}${extension}`;
};

// These characters alter an unescaped object URL instead of remaining in its path.
const unsupportedUploadFileNameCharacter = /[%#?\\\t\r\n]/;

export const isUploadFileNameAllowed = (fileName: string) =>
  Boolean(fileName) && !unsupportedUploadFileNameCharacter.test(fileName);

export const hasImageClipboardData = (
  items: Array<{ kind: string; type: string }>,
  fileCount: number,
) => fileCount === 0 && items.some((item) => item.type.startsWith("image/"));
