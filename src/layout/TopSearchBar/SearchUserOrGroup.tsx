import { CloseOutlined } from "@ant-design/icons";
import { GroupItem, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { Button, Input, InputRef } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { message } from "@/AntdGlobalComp";
import { searchADMembers } from "@/api/organization";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/common";

import { IMSDK } from "../MainContentWrap";

interface ISearchUserOrGroupProps {
  isSearchGroup: boolean;
  openUserCardWithData: (data: CardInfo) => void;
  openGroupCardWithData: (data: GroupItem) => void;
}

const SearchUserOrGroup: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  ISearchUserOrGroupProps
> = ({ isSearchGroup, openUserCardWithData, openGroupCardWithData }, ref) => {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<InputRef>(null);
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus());
    }
  }, [isOverlayOpen]);

  const searchData = async () => {
    if (!keyword) return;
    setLoading(true);
    if (isSearchGroup) {
      try {
        const { data } = await IMSDK.getSpecifiedGroupsInfo([keyword]);
        const groupInfo = data[0];
        setLoading(false);
        if (!groupInfo) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        openGroupCardWithData(groupInfo);
      } catch (error) {
        setLoading(false);
        if ((error as WSEvent).errCode === 1004) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        feedbackToast({ error });
      }
    } else {
      try {
        const {
          data: { total, members },
        } = await searchADMembers({
          keyword,
          pagination: { pageNumber: 1, showNumber: 20 },
        });
        setLoading(false);
        if (!total) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        const member = members[0];
        const userID = member.userID || member.username;
        const friendInfo = useContactStore
          .getState()
          .friendList.find((friend) => friend.userID === userID);

        openUserCardWithData({
          ...(friendInfo ?? {}),
          userID,
          nickname: member.nickname || member.displayName || member.username,
          faceURL: "",
        });
      } catch (error) {
        setLoading(false);
        if ((error as WSEvent).errCode === 1004) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        feedbackToast({ error });
      }
    }
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={332}
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={() => {
        setKeyword("");
      }}
      ignoreClasses=".ignore-drag, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div className="flex h-12 items-center justify-between bg-[var(--gap-text)] px-5.5">
        <div>
          {isSearchGroup ? t("placeholder.addGroup") : t("placeholder.addFriends")}
        </div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="ignore-drag">
        <div className="border-b border-[var(--gap-text)] px-5.5 py-6">
          <Input.Search
            ref={inputRef}
            className="no-addon-search"
            placeholder={t("placeholder.pleaseEnter")}
            value={keyword}
            addonAfter={null}
            spellCheck={false}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={searchData}
          />
        </div>
        <div className="flex justify-end px-5.5 py-2.5">
          <Button
            loading={loading}
            className="px-6"
            type="primary"
            disabled={!keyword}
            onClick={searchData}
          >
            {t("confirm")}
          </Button>
          <Button
            className="ml-3 border-0 bg-[var(--chat-bubble)] px-6"
            onClick={closeOverlay}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(SearchUserOrGroup));
