export const uint8ArrayToDataUrl = (
  bytes: Uint8Array,
  mimeType = "image/png",
) => `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
