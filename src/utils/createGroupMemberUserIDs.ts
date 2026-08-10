export const getCreateGroupMemberUserIDs = (userIDs: string[], selfUserID?: string) =>
  [...new Set(userIDs)].filter((userID) => userID && userID !== selfUserID);
