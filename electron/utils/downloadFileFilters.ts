const getFileExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
};

export const getDownloadFileFilters = (fileName: string) => {
  const extension = getFileExtension(fileName);
  if (!extension) return [{ name: "All Files (*.*)", extensions: ["*"] }];

  return [
    { name: `${extension.toUpperCase()} Files (*.${extension})`, extensions: [extension] },
    { name: "All Files (*.*)", extensions: ["*"] },
  ];
};
