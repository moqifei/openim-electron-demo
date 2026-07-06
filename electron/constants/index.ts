export const IpcMainToRender = {
  appResume: "appResume",
  mainWindowStateChanged: "mainWindowStateChanged",
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
  startScreenshot: "startScreenshot",
  saveScreenshotFile: "saveScreenshotFile",
};
