import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { FriendUserItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Button, Input, Modal } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import {
  FC,
  memo,
  useMemo,
  useState,
} from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";

interface ShareCardModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (user: FriendUserItem) => void;
}

const ShareCardModal: FC<ShareCardModalProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const friendList = useContactStore((state) => state.friendList);
  const [searchKey, setSearchKey] = useState("");
  const [selectedUser, setSelectedUser] = useState<FriendUserItem | null>(null);

  const filteredList = useMemo(() => {
    if (!searchKey.trim()) return friendList;
    const key = searchKey.trim().toLowerCase();
    return friendList.filter(
      (f) =>
        f.nickname?.toLowerCase().includes(key) ||
        f.remark?.toLowerCase().includes(key) ||
        f.userID?.toLowerCase().includes(key),
    );
  }, [friendList, searchKey]);

  const toggleUser = (user: FriendUserItem) => {
    if (selectedUser?.userID === user.userID) {
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
    }
  };

  const handleConfirm = () => {
    if (selectedUser) {
      onConfirm(selectedUser);
    }
  };

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={open}
      closable={false}
      width={680}
      onCancel={onCancel}
      destroyOnClose
      styles={{
        mask: { opacity: 0, transition: "none" },
      }}
      className="no-padding-modal max-w-[80vw]"
      maskTransitionName=""
      afterClose={() => {
        setSearchKey("");
        setSelectedUser(null);
      }}
    >
      <div className="flex h-16 items-center justify-between bg-[var(--gap-text)] px-7">
        <div>{t("placeholder.shareCard")}</div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={onCancel}
        />
      </div>
      <div className="mx-9 mt-5 flex h-[480px] rounded-md border border-[var(--gap-text)]">
        <div className="flex flex-1 flex-col border-r border-[var(--gap-text)]">
          <div className="px-5 pt-5">
            <Input
              prefix={<SearchOutlined rev={undefined} />}
              placeholder={t("placeholder.search")}
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              allowClear
            />
          </div>
          <div className="px-5 pb-2 pt-3 text-xs text-[var(--sub-text)]">
            {t("placeholder.contacts")} &gt;{" "}
            <span className="text-[var(--primary)]">{t("placeholder.myFriend")}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredList.map((item) => {
              const isChecked = selectedUser?.userID === item.userID;
              const showName = item.remark || item.nickname || item.userID;
              return (
                <div
                  key={item.userID}
                  className={clsx(
                    "mx-2 flex cursor-pointer items-center justify-between rounded-md px-3.5 py-2.5 hover:bg-[var(--primary-active)]",
                  )}
                  onClick={() => toggleUser(item)}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-3 h-4 w-4 accent-[var(--primary)]"
                      checked={isChecked}
                      readOnly
                    />
                    <OIMAvatar src={item.faceURL} text={showName} />
                    <div className="ml-3 max-w-[120px] truncate">{showName}</div>
                  </div>
                </div>
              );
            })}
            {!filteredList.length && (
              <div className="py-10 text-center text-sm text-[var(--sub-text)]">
                {t("empty.noSearchResults")}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="mx-5 py-5.5">
            {t("placeholder.selected")}
            <span className="text-[var(--primary)]">{` ${selectedUser ? 1 : 0} `}</span>
          </div>
          <div className="mb-3 flex-1 overflow-y-auto">
            {selectedUser && (
              <div className="mx-2 flex items-center justify-between rounded-md px-3.5 py-2.5">
                <div className="flex items-center">
                  <OIMAvatar
                    src={selectedUser.faceURL}
                    text={selectedUser.remark || selectedUser.nickname || selectedUser.userID}
                  />
                  <div className="ml-3 max-w-[120px] truncate">
                    {selectedUser.remark || selectedUser.nickname || selectedUser.userID}
                  </div>
                </div>
                <CloseOutlined
                  className="cursor-pointer text-[var(--sub-text)]"
                  rev={undefined}
                  onClick={() => setSelectedUser(null)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end px-9 py-6">
        <Button
          className="mr-6 border-0 bg-[var(--chat-bubble)] px-6"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button
          className="px-6"
          type="primary"
          disabled={!selectedUser}
          onClick={handleConfirm}
        >
          {t("confirm")}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(ShareCardModal);
