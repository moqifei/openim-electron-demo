import { expect, test } from "@playwright/test";
import i18n from "i18next";

import zh from "../src/i18n/resources/zh.json";
import {
  getFileTransferErrorMessage,
  isFileSizeExceededError,
} from "../src/utils/fileTransferError";

test("recognizes the upload size limit error before wrapping it in a failure toast", () => {
  expect(isFileSizeExceededError(new Error("File size exceeds 200 MiB"))).toBe(true);
  expect(isFileSizeExceededError(new Error("Request failed with status code 500"))).toBe(
    false,
  );
});

test("maps the upload size limit error to the Chinese popup text", async () => {
  await i18n.init({
    resources: { "zh-CN": { translation: zh } },
    lng: "zh-CN",
  });

  expect(getFileTransferErrorMessage(new Error("File size exceeds 200 MiB"), "upload")).toBe(
    "上传文件大小不得超过200M",
  );
});
