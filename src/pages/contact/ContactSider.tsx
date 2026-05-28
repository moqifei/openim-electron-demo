import { ApartmentOutlined } from "@ant-design/icons";
import { Badge } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import group_notifications from "@/assets/images/contact/group_notifications.png";
import my_groups from "@/assets/images/contact/my_groups.png";
import recently from "@/assets/images/chooseModal/recently.png";
import FlexibleSider from "@/components/FlexibleSider";
import { useContactStore } from "@/store";

interface LinkItem {
  label: string;
  icon: string | React.ReactNode;
  path: string;
}

const Links: LinkItem[] = [
  {
    label: t("placeholder.recentContact") || "最近联系人",
    icon: recently,
    path: "/contact",
  },
  {
    label: t("placeholder.groupNotification"),
    icon: group_notifications,
    path: "/contact/groupNotifications",
  },
  {
    label: t("placeholder.myGroup"),
    icon: my_groups,
    path: "/contact/myGroups",
  },
  {
    label: t("placeholder.organization") || "组织结构",
    icon: <ApartmentOutlined className="text-xl text-[#ff4d4f]" />,
    path: "/contact/organization",
  },
];

i18n.on("languageChanged", () => {
  Links[0].label = t("placeholder.recentContact") || "最近联系人";
  Links[1].label = t("placeholder.groupNotification");
  Links[2].label = t("placeholder.myGroup");
  Links[3].label = t("placeholder.organization") || "组织结构";
});

const ContactSider = () => {
  const [selectIndex, setSelectIndex] = useState(0);
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash.includes("/contact/groupNotifications")) {
      setSelectIndex(1);
    } else if (location.hash.includes("/contact/myGroups")) {
      setSelectIndex(2);
    } else if (location.hash.includes("/contact/organization")) {
      setSelectIndex(3);
    } else {
      setSelectIndex(0);
    }
  }, []);

  const getBadge = (index: number) => {
    if (index === 1) {
      return unHandleGroupApplicationCount;
    }
    return 0;
  };

  return (
    <FlexibleSider needHidden={true}>
      <div className="h-full bg-white">
        <div className="pb-3 pl-5.5 pt-5.5 text-base font-extrabold">
          {t("placeholder.contact")}
        </div>
        <ul>
          {Links.map((item, index) => {
            return (
              <li
                key={item.path}
                className={clsx(
                  "mx-2 flex cursor-pointer items-center rounded-md p-3 text-sm hover:bg-[var(--primary-active)]",
                  {
                    "bg-[#f3f8fe]": index === selectIndex,
                  },
                )}
                onClick={() => {
                  setSelectIndex(index);
                  navigate(String(item.path));
                }}
              >
                <Badge size="small" count={getBadge(index)}>
                  {typeof item.icon === "string" ? (
                    <img
                      alt={item.label}
                      src={item.icon}
                      className="mr-3 h-10.5 w-10.5 rounded-md"
                    />
                  ) : (
                    <div className="mr-3 flex h-10.5 w-10.5 items-center justify-center rounded-md bg-[#fff2f0]">
                      {item.icon}
                    </div>
                  )}
                </Badge>
                <div className="text-sm">{item.label}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </FlexibleSider>
  );
};
export default ContactSider;
