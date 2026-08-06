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

export const hasImageClipboardData = (
  items: Array<{ kind: string; type: string }>,
  fileCount: number,
) => fileCount === 0 && items.some((item) => item.type.startsWith("image/"));
