import { expect, test } from "@playwright/test";

import { getPngDimensions } from "../electron/utils/pngDimensions";
import { uint8ArrayToDataUrl } from "../electron/utils/screenshotData";

test("encodes screenshot bytes as a valid base64 data URL", () => {
  const dataUrl = uint8ArrayToDataUrl(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );

  expect(dataUrl).toBe("data:image/png;base64,iVBORw==");
});

test("reads width and height from a PNG IHDR header", () => {
  const pngHeader = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x07, 0x80, 0x00, 0x00, 0x04, 0x38,
  ]);

  expect(getPngDimensions(pngHeader)).toEqual({ width: 1920, height: 1080 });
});

test("rejects data that is not long enough to contain PNG dimensions", () => {
  expect(() => getPngDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(
    "Invalid PNG data",
  );
});
