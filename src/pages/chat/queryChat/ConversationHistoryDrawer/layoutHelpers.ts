export const DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO = 0.4;
const MIN_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO = 0.32;
const MAX_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO = 0.6;

const clampConversationHistoryDrawerWidthRatio = (widthRatio: number) =>
  Math.min(
    MAX_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO,
    Math.max(MIN_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO, widthRatio),
  );

export const getConversationHistoryDrawerWidth = (
  containerWidth: number,
  widthRatio = DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO,
) => Math.round(containerWidth * clampConversationHistoryDrawerWidthRatio(widthRatio));

export const getConversationHistoryDrawerWidthRatio = (
  containerLeft: number,
  containerWidth: number,
  pointerX: number,
) => {
  if (containerWidth <= 0) {
    return DEFAULT_CONVERSATION_HISTORY_DRAWER_WIDTH_RATIO;
  }
  return clampConversationHistoryDrawerWidthRatio(
    (containerLeft + containerWidth - pointerX) / containerWidth,
  );
};
