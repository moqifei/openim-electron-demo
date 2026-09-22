import { expect, test } from "@playwright/test";
import fs from "node:fs";

const fileMessage = fs.readFileSync(
  "src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx",
  "utf8",
);

test("downloads and opens an un-downloaded file from the open action", () => {
  expect(fileMessage).toMatch(
    /const handleDownloadAndOpen = useCallback\(\s*async \(\) => \{\s*const savedPath = await downloadFile\(\);\s*if \(savedPath\) await openDownloadedFile\(savedPath\);/,
  );
});

test("shows the requested file actions before and after download", () => {
  expect(fileMessage).toMatch(
    /localFilePath \? \(\s*<>\s*<FileActionButton\s+label=\{t\("placeholder.open"\)\}\s+onClick=\{\(\) => \{\s*void handleOpen\(\);\s*\}\}\s+\/>\s*<FileActionButton\s+label=\{t\("placeholder.openFolder"\)\}[\s\S]*?<FileActionButton\s+label=\{t\("placeholder.saveAs"\)\}/,
  );
  expect(fileMessage).toMatch(
    /: \(\s*<>\s*<FileActionButton\s+label=\{t\("placeholder.open"\)\}\s+onClick=\{\(\) => void handleDownloadAndOpen\(\)\}\s+\/>\s*<FileActionButton\s+label=\{t\("placeholder.save"\)\}[\s\S]*?<FileActionButton\s+label=\{t\("placeholder.saveAs"\)\}/,
  );
});
