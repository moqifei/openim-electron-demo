export const APP_NAME = "OpenCorp-Base";
// 版本号由 vite.config.ts 在构建时从 package.json 注入（__APP_VERSION__ / __SDK_VERSION__）
export const APP_VERSION = __APP_VERSION__;
export const SDK_VERSION = __SDK_VERSION__;
export const isSaveLog = process.env.NODE_ENV !== "development";
