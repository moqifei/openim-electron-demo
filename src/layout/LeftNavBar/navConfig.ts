export type MainNavConfig = {
  title: string;
  path: string;
  kind: "digitalTwin" | "agents" | "chat" | "contact";
};

export const getMainNavConfig = ({
  chatTitle,
  contactTitle,
}: {
  chatTitle: string;
  contactTitle: string;
}): MainNavConfig[] => [
  {
    title: "分身",
    path: "/digital-twin",
    kind: "digitalTwin",
  },
  {
    title: "智能体",
    path: "/agents",
    kind: "agents",
  },
  {
    title: chatTitle,
    path: "/chat",
    kind: "chat",
  },
  {
    title: contactTitle,
    path: "/contact",
    kind: "contact",
  },
];
