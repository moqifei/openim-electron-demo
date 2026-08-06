import { expect, test } from "@playwright/test";

import {
  dataUrlToImageFile,
  hasImageClipboardData,
} from "../src/utils/chatAttachment";

test("converts a PNG data URL into an image File", () => {
  const file = dataUrlToImageFile(
    "data:image/png;base64,aGVsbG8=",
    "clipboard.png",
  );

  expect(file.name).toBe("clipboard.png");
  expect(file.type).toBe("image/png");
  expect(file.size).toBe(5);
});

test("only requests the native clipboard fallback for image clipboard data", () => {
  expect(
    hasImageClipboardData([{ kind: "string", type: "text/plain" }], 0),
  ).toBe(false);
  expect(
    hasImageClipboardData([{ kind: "file", type: "image/png" }], 1),
  ).toBe(false);
  expect(
    hasImageClipboardData([{ kind: "file", type: "image/png" }], 0),
  ).toBe(true);
});
