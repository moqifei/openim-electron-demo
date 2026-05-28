import { CloseOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useImperativeHandle, useRef, useState } from "react";

import ChooseBox, { ChooseBoxHandle } from "@/pages/common/ChooseModal/ChooseBox";
import { CheckListItem } from "@/pages/common/ChooseModal/ChooseBox/CheckItem";

export interface ForwardModalState {
  open: boolean;
  onConfirm?: (targets: CheckListItem[]) => void;
  onCancel?: () => void;
}

export interface ForwardModalHandle {
  openModal: (onConfirm: (targets: CheckListItem[]) => void) => void;
  closeModal: () => void;
}

const ForwardModal: ForwardRefRenderFunction<ForwardModalHandle, unknown> = (_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const chooseBoxRef = useRef<ChooseBoxHandle>(null);
  const confirmCallbackRef = useRef<((targets: CheckListItem[]) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    openModal: (onConfirm) => {
      confirmCallbackRef.current = onConfirm;
      setIsOpen(true);
    },
    closeModal: () => {
      setIsOpen(false);
      confirmCallbackRef.current = null;
      chooseBoxRef.current?.resetState();
    },
  }));

  const handleConfirm = () => {
    const targets = chooseBoxRef.current?.getCheckedList() ?? [];
    if (!targets.length) return;
    confirmCallbackRef.current?.(targets);
    setIsOpen(false);
    chooseBoxRef.current?.resetState();
  };

  const handleCancel = () => {
    setIsOpen(false);
    confirmCallbackRef.current = null;
    chooseBoxRef.current?.resetState();
  };

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={isOpen}
      closable={false}
      width={680}
      onCancel={handleCancel}
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      className="no-padding-modal max-w-[80vw]"
      maskTransitionName=""
    >
      <div className="flex h-16 items-center justify-between bg-[var(--gap-text)] px-7">
        <div>{t("placeholder.forward")}</div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={handleCancel}
        />
      </div>
      <ChooseBox className="!h-[60vh]" ref={chooseBoxRef} />
      <div className="flex justify-end px-9 py-6">
        <Button
          className="mr-6 border-0 bg-[var(--chat-bubble)] px-6"
          onClick={handleCancel}
        >
          {t("cancel")}
        </Button>
        <Button className="px-6" type="primary" onClick={handleConfirm}>
          {t("confirm")}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(forwardRef(ForwardModal));
