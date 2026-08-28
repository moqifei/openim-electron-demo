const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to clipboard data"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

export const copyImageToClipboard = async (imageUrl: string) => {
  if (!imageUrl) throw new Error("Image URL is empty");

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png";

  if (window.electronAPI?.writeClipboardImageFile) {
    await window.electronAPI.writeClipboardImageFile(await blob.arrayBuffer());
    return;
  }

  if (window.electronAPI?.writeClipboardImage) {
    await window.electronAPI.writeClipboardImage(await blobToDataUrl(blob));
    return;
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      [mimeType]: blob,
    }),
  ]);
};
