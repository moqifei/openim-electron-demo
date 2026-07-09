import contactIcon from "@/assets/images/nav/nav_bar_contact.png";
import contactIconActive from "@/assets/images/nav/nav_bar_contact_active.png";
import messageIcon from "@/assets/images/nav/nav_bar_message.png";
import messageIconActive from "@/assets/images/nav/nav_bar_message_active.png";
import { publicAsset } from "@/utils/publicAsset";

import { getMainNavConfig } from "./navConfig";

const digitalTwinIcon = publicAsset("icons/shuzifenshen.png");
const agentIcon = publicAsset("icons/a-iconai.png");

export type MainNavItem = {
  icon: string;
  icon_active: string;
  title: string;
  path: string;
};

export const getMainNavItems = ({
  chatTitle,
  contactTitle,
}: {
  chatTitle: string;
  contactTitle: string;
}): MainNavItem[] => {
  const icons = {
    digitalTwin: [digitalTwinIcon, digitalTwinIcon],
    agents: [agentIcon, agentIcon],
    chat: [messageIcon, messageIconActive],
    contact: [contactIcon, contactIconActive],
  };

  return getMainNavConfig({ chatTitle, contactTitle }).map((item) => {
    const [icon, icon_active] = icons[item.kind];
    return {
      ...item,
      icon,
      icon_active,
    };
  });
};
