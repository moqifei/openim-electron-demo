export const DIGITAL_TWIN_REPLIES_CHANGED = "digitalTwinRepliesChanged";

export const notifyDigitalTwinRepliesChanged = () => {
  window.dispatchEvent(new Event(DIGITAL_TWIN_REPLIES_CHANGED));
};
