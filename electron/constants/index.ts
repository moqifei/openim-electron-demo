export const IpcMainToRender = {
  appResume: "appResume",
  mainWindowStateChanged: "mainWindowStateChanged",
  triggerScreenshot: "triggerScreenshot",
  // 主进程在退出前请求渲染进程执行 OpenIM 退出登录（清理登录态）
  requestLogoutBeforeQuit: "requestLogoutBeforeQuit",
};

export const IpcRenderToMain = {
  showMainWindow: "showMainWindow",
  clearSession: "clearSession",
  minimizeWindow: "minimizeWindow",
  maxmizeWindow: "maxmizeWindow",
  closeWindow: "closeWindow",
  showMessageBox: "showMessageBox",
  setKeyStore: "setKeyStore",
  getKeyStore: "getKeyStore",
  getKeyStoreSync: "getKeyStoreSync",
  showInputContextMenu: "showInputContextMenu",
  getDataPath: "getDataPath",
  openFileDialog: "openFileDialog",
  saveDownloadedFile: "saveDownloadedFile",
  writeClipboardImage: "writeClipboardImage",
  startScreenshot: "startScreenshot",
  readClipboardImage: "readClipboardImage",
  saveScreenshotFile: "saveScreenshotFile",
  probeServerEnvironment: "probeServerEnvironment",
  probeImWsPort: "probeImWsPort",
};
