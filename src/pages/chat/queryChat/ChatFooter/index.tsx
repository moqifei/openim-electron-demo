import { CloseOutlined } from "@ant-design/icons";
import { MessageItem, MessageType } from "@openim/wasm-client-sdk";
import { useLatest } from "ahooks";
import { Button } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useRef, useState } from "react";

import CKEditor, { CKEditorRef } from "@/components/CKEditor";
import { getCleanText } from "@/components/CKEditor/utils";
import i18n from "@/i18n";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";

import SendActionBar from "./SendActionBar";
import { useFileMessage } from "./SendActionBar/useFileMessage";
import { useSendMessage } from "./useSendMessage";

const sendActions = [
  { label: t("placeholder.sendWithEnter"), key: "enter" },
  { label: t("placeholder.sendWithShiftEnter"), key: "enterwithshift" },
];

i18n.on("languageChanged", () => {
  sendActions[0].label = t("placeholder.sendWithEnter");
  sendActions[1].label = t("placeholder.sendWithShiftEnter");
});

const ChatFooter: ForwardRefRenderFunction<unknown, unknown> = (_, ref) => {
  const [html, setHtml] = useState("");
  const latestHtml = useLatest(html);
  const editorRef = useRef<CKEditorRef>(null);

  const { getImageMessage, getFileMessage, getCardMessage } = useFileMessage();
  const { sendMessage } = useSendMessage();
  const quoteMessage = useConversationStore((state) => state.quoteMessage);
  const setQuoteMessage = useConversationStore((state) => state.setQuoteMessage);

  const onChange = (value: string) => {
    setHtml(value);
  };

  const enterToSend = async () => {
    const cleanText = getCleanText(latestHtml.current);
    if (!cleanText) return;
    setHtml("");

    let message: MessageItem;
    const storeQuoteMessage = useConversationStore.getState().quoteMessage;
    const storeSetQuoteMessage = useConversationStore.getState().setQuoteMessage;
    if (storeQuoteMessage) {
      const { data } = await IMSDK.createQuoteMessage({
        text: cleanText,
        message: JSON.stringify(storeQuoteMessage),
      });
      message = data;
      storeSetQuoteMessage(undefined);
    } else {
      const { data } = await IMSDK.createTextMessage(cleanText);
      message = data;
    }

    sendMessage({ message });
  };

  const getQuotePreview = (msg: MessageItem) => {
    switch (msg.contentType) {
      case MessageType.TextMessage:
        return msg.textElem?.content || "";
      case MessageType.PictureMessage:
        return t("messageDescription.imageMessage");
      case MessageType.FileMessage:
        return t("messageDescription.fileMessage", { file: msg.fileElem?.fileName || "" });
      case MessageType.CardMessage:
        return t("messageDescription.cardMessage");
      case MessageType.MergeMessage:
        return msg.mergeElem?.title || t("messageDescription.mergeMessage");
      default:
        return t("messageDescription.catchMessage");
    }
  };

  return (
    <footer className="relative h-full bg-white py-px">
      <div className="flex h-full flex-col border-t border-t-[var(--gap-text)]">
        <SendActionBar
          sendMessage={sendMessage}
          getImageMessage={getImageMessage}
          getFileMessage={getFileMessage}
          getCardMessage={getCardMessage}
          editorRef={editorRef}
        />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {quoteMessage && (
            <div className="flex items-center justify-between border-b border-[var(--gap-text)] bg-[var(--chat-bubble)] px-4 py-2">
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="text-xs text-[var(--primary)]">
                  {t("placeholder.reply")} {quoteMessage.senderNickname}
                </span>
                <span className="truncate text-xs text-[var(--sub-text)]">
                  {getQuotePreview(quoteMessage)}
                </span>
              </div>
              <CloseOutlined
                className="cursor-pointer text-[var(--sub-text)]"
                rev={undefined}
                onClick={() => setQuoteMessage(undefined)}
              />
            </div>
          )}
          <CKEditor ref={editorRef} value={html} onEnter={enterToSend} onChange={onChange} />
          <div className="flex items-center justify-end py-2 pr-3">
            <Button className="w-fit px-6 py-1" type="primary" onClick={enterToSend}>
              {t("placeholder.send")}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(forwardRef(ChatFooter));
