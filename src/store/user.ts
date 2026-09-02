import { t } from "i18next";
import { create } from "zustand";

import { BusinessUserInfo, getBusinessUserInfo } from "@/api/login";
import { getADDepartmentList, searchADMembers } from "@/api/organization";
import { IMSDK } from "@/layout/MainContentWrap";
import router from "@/routes";
import { feedbackToast } from "@/utils/common";
import {
  clearIMProfile,
  getLocale,
  markManualLogout,
  setLocale,
} from "@/utils/storage";

import { useContactStore } from "./contact";
import { useConversationStore } from "./conversation";
import { AppSettings, IMConnectState, UserStore } from "./type";

type IMLogoutError = {
  errCode?: number;
  errMsg?: string;
  message?: string;
};

const isIgnorableLogoutError = (error: unknown) => {
  const logoutError = error as IMLogoutError;
  const errorText = `${logoutError?.errMsg ?? ""} ${logoutError?.message ?? ""}`;

  return (
    logoutError?.errCode === 10005 || /not\s+login|not\s+logged\s+in/i.test(errorText)
  );
};

export const useUserStore = create<UserStore>()((set, get) => ({
  syncState: "success",
  progress: 0,
  reinstall: true,
  isLogining: false,
  connectState: "success",
  selfInfo: {} as BusinessUserInfo,
  appSettings: {
    locale: getLocale(),
    closeAction: "miniSize",
  },
  updateSyncState: (syncState: IMConnectState) => {
    set({ syncState });
  },
  updateProgressState: (progress: number) => {
    set({ progress });
  },
  updateReinstallState: (reinstall: boolean) => {
    set({ reinstall });
  },
  updateIsLogining: (isLogining: boolean) => {
    set({ isLogining });
  },
  updateConnectState: (connectState: IMConnectState) => {
    set({ connectState });
  },
  getSelfInfoByReq: () => {
    IMSDK.getSelfUserInfo()
      .then(async ({ data }) => {
        set(() => ({ selfInfo: data as unknown as BusinessUserInfo }));
        const { data: bizData } = await getBusinessUserInfo([data.userID]);
        console.log(
          "[selfInfo] businessUserInfo raw:",
          JSON.stringify(bizData.users?.[0], null, 2),
        );
        const merged = { ...data, ...bizData.users[0] };
        // Fetch AD department info and cache into selfInfo.
        // The search component (SearchUserOrGroup) proves that searching by
        // AD account/username returns members with departmentName.
        try {
          const account = (bizData.users?.[0] as any)?.account || data.nickname;
          console.log("[selfInfo] fetching AD department, keyword:", account);
          const { data: adData } = await searchADMembers({
            keyword: account,
            pagination: { pageNumber: 1, showNumber: 5 },
          });
          const adMember = adData.members?.[0];
          console.log(
            "[selfInfo] AD search result:",
            JSON.stringify(
              {
                total: adData.total,
                membersCount: adData.members?.length ?? 0,
                member: adMember
                  ? {
                      userID: adMember.userID,
                      username: adMember.username,
                      nickname: adMember.nickname,
                      departmentName: adMember.departmentName,
                      departmentID: adMember.departmentID,
                    }
                  : null,
              },
              null,
              2,
            ),
          );

          if (adMember) {
            // Priority 1: AD returned departmentName directly
            if (adMember.departmentName) {
              merged.departmentName = adMember.departmentName;
              console.log(
                "[selfInfo] cached departmentName (from AD field):",
                merged.departmentName,
              );
            } else if (adMember.departmentID) {
              // Priority 2: Parse from LDAP DN (ou=部门名,...)
              const dnMatch = adMember.departmentID.match(/ou=([^,]+)/i);
              if (dnMatch?.[1]) {
                merged.departmentName = dnMatch[1];
                console.log(
                  "[selfInfo] cached departmentName (from DN parse):",
                  merged.departmentName,
                );
              } else {
                // Priority 3: Fallback to getADDepartmentList lookup
                try {
                  console.log("[selfInfo] DN parse failed, trying getADDepartmentList");
                  const { data: deptData } = await getADDepartmentList();
                  const dept = deptData.departments?.find(
                    (d) => d.departmentID === adMember.departmentID,
                  );
                  if (dept?.name) {
                    merged.departmentName = dept.name;
                    console.log(
                      "[selfInfo] cached departmentName (from dept list):",
                      merged.departmentName,
                    );
                  }
                } catch (deptErr) {
                  console.warn("[selfInfo] getADDepartmentList failed", deptErr);
                }
              }
            }
          }

          // Fallback: try nickname
          if (!merged.departmentName && data.nickname && data.nickname !== account) {
            const { data: adData2 } = await searchADMembers({
              keyword: data.nickname,
              pagination: { pageNumber: 1, showNumber: 5 },
            });
            const adMember2 = adData2.members?.[0];
            if (adMember2?.departmentName) {
              merged.departmentName = adMember2.departmentName;
              console.log(
                "[selfInfo] cached departmentName (via nickname):",
                merged.departmentName,
              );
            } else if (adMember2?.departmentID) {
              const dnMatch2 = adMember2.departmentID.match(/ou=([^,]+)/i);
              if (dnMatch2?.[1]) {
                merged.departmentName = dnMatch2[1];
                console.log(
                  "[selfInfo] cached departmentName (via nickname + DN):",
                  merged.departmentName,
                );
              }
            }
          }

          if (!merged.departmentName) {
            console.warn(
              "[selfInfo] no AD department found. account:",
              account,
              "nickname:",
              data.nickname,
            );
          }
        } catch (adErr) {
          console.warn("[selfInfo] AD department fetch failed (non-fatal)", adErr);
        }
        set((state) => ({ selfInfo: { ...state.selfInfo, ...merged } }));
      })
      .catch((error) => {
        feedbackToast({ error, msg: t("toast.getSelfInfoFailed") });
        get().userLogout();
      });
  },
  updateSelfInfo: (info: Partial<BusinessUserInfo>) => {
    set((state) => ({ selfInfo: { ...state.selfInfo, ...info } }));
  },
  updateAppSettings: (settings: Partial<AppSettings>) => {
    if (settings.locale) {
      setLocale(settings.locale);
    }
    set((state) => ({ appSettings: { ...state.appSettings, ...settings } }));
  },
  userLogout: async (force?: boolean, manual?: boolean) => {
    if (!force) {
      try {
        await IMSDK.logout();
      } catch (error) {
        if (!isIgnorableLogoutError(error)) {
          throw error;
        }
        console.warn("ignore logout sdk error", error);
      }
    }
    if (manual) markManualLogout();
    clearIMProfile();
    set({ selfInfo: {} as BusinessUserInfo, progress: 0 });
    useContactStore.getState().clearContactStore();
    useConversationStore.getState().clearConversationStore();
    router.navigate("/login");
  },
}));
