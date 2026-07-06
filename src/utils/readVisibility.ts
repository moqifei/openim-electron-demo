type MainWindowState = {
  focused?: boolean;
  visible?: boolean;
  minimized?: boolean;
};

export const READ_VISIBILITY_CHANGED = "readVisibilityChanged";

let browserFocused = typeof document === "undefined" ? true : document.hasFocus();
let electronWindowState: MainWindowState = {
  focused: true,
  visible: true,
  minimized: false,
};
let initialized = false;

const updateBrowserFocus = () => {
  browserFocused = document.hasFocus();
  window.dispatchEvent(new Event(READ_VISIBILITY_CHANGED));
};

export const initReadVisibilityMonitor = () => {
  if (initialized || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  initialized = true;
  updateBrowserFocus();

  window.addEventListener("focus", updateBrowserFocus);
  window.addEventListener("blur", updateBrowserFocus);
  document.addEventListener("visibilitychange", updateBrowserFocus);

  window.electronAPI?.subscribe("mainWindowStateChanged", (state: MainWindowState) => {
    electronWindowState = {
      ...electronWindowState,
      ...state,
    };
    window.dispatchEvent(new Event(READ_VISIBILITY_CHANGED));
  });
};

export const canAutoMarkConversationAsRead = () => {
  if (typeof document !== "undefined") {
    if (document.visibilityState !== "visible") return false;
    if (!document.hasFocus() && !browserFocused) return false;
  }
  if (window.electronAPI) {
    if (electronWindowState.minimized) return false;
    if (electronWindowState.visible === false) return false;
    if (electronWindowState.focused === false) return false;
  }
  return true;
};
