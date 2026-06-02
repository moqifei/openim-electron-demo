import { CloseOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { t } from "i18next";
import {
  FC,
  memo,
  useRef,
} from "react";

import ChooseBox, { ChooseBoxHandle } from "@/pages/common/ChooseModal/ChooseBox";

interface ShareCardModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (user: {
    userID: string;
    nickname: string;
    faceURL: string;
  }) => void;
}

const ShareCardModal: FC<ShareCardModalProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const chooseBoxRef = useRef<ChooseBoxHandle>(null);

  const handleConfirm = () => {
    const targets = chooseBoxRef.current?.getCheckedList() ?? [];
    if (!targets.length) return;
    const target = targets[0];
    onConfirm({
      userID: target.userID!,
      nickname: target.nickname || target.remark || target.userID!,
      faceURL: target.faceURL || "",
    });
    chooseBoxRef.current?.resetState();
  };

  const handleCancel = () => {
    chooseBoxRef.current?.resetState();
    onCancel();
  };

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={open}
      closable={false}
      width={680}
      onCancel={handleCancel}
      destroyOnClose
      styles={{
        mask: { opacity: 0, transition: "none" },
      }}
      className="no-padding-modal max-w-[80vw]"
      maskTransitionName=""
    >
      <div className="flex h-16 items-center justify-between bg-[var(--gap-text)] px-7">
        <div>{t("placeholder.shareCard")}</div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={handleCancel}
        />
      </div>
      <ChooseBox className="!h-[60vh]" ref={chooseBoxRef} chooseOneOnly={true} />
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

export default memo(ShareCardModal);
