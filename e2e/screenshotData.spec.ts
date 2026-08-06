import { expect, test } from "@playwright/test";

import { uint8ArrayToDataUrl } from "../electron/utils/screenshotData";

test("encodes screenshot bytes as a valid base64 data URL", () => {
  const dataUrl = uint8ArrayToDataUrl(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );

  expect(dataUrl).toBe("data:image/png;base64,iVBORw==");
});
