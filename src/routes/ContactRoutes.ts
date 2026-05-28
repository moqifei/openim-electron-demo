const contactRoutes = [
  {
    path: "groupNotifications",
    async lazy() {
      const { GroupNotifications } = await import("@/pages/contact/groupNotifications");
      return { Component: GroupNotifications };
    },
  },
  {
    index: true,
    async lazy() {
      const { MyFriends } = await import("@/pages/contact/myFriends");
      return { Component: MyFriends };
    },
  },
  {
    path: "myGroups",
    async lazy() {
      const { MyGroups } = await import("@/pages/contact/myGroups");
      return { Component: MyGroups };
    },
  },
  {
    path: "newFriends",
    async lazy() {
      const { NewFriends } = await import("@/pages/contact/newFriends");
      return { Component: NewFriends };
    },
  },
  {
    path: "organization",
    async lazy() {
      const { Organization } = await import("@/pages/contact/organization");
      return { Component: Organization };
    },
  },
];

export default contactRoutes;
