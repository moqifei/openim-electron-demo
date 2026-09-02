import { test, expect } from "@playwright/test";

import {
  getDownloadErrorDiagnostics,
  getDownloadUrlLogDetails,
  getDownloadXhrDiagnostics,
} from "../src/utils/fileDownloadDiagnostics";

test("redacts download URL query parameters from logs", () => {
  const details = getDownloadUrlLogDetails(
    "https://files.example.test:8443/object/report.docx?token=secret&signature=private#fragment",
  );

  expect(details).toEqual({
    protocol: "https:",
    host: "files.example.test",
    port: "8443",
    pathname: "/object/report.docx",
  });
  expect(JSON.stringify(details)).not.toContain("secret");
  expect(JSON.stringify(details)).not.toContain("private");
});

test("captures the received size and XHR state on a download failure", () => {
  const details = getDownloadXhrDiagnostics(
    {
      readyState: 4,
      status: 0,
      statusText: "",
      responseURL: "http://files.example.test/object/report.docx",
      timeout: 0,
    },
    { lengthComputable: true, loaded: 1048576, total: 20971520 },
    20971520,
    true,
  );

  expect(details).toEqual({
    readyState: 4,
    status: 0,
    statusText: "",
    timeout: 0,
    responseUrl: {
      protocol: "http:",
      host: "files.example.test",
      port: "80",
      pathname: "/object/report.docx",
    },
    loaded: 1048576,
    total: 20971520,
    lengthComputable: true,
    online: true,
  });
});

test("preserves native disk error codes for save failures", () => {
  const error = Object.assign(new Error("write failed"), { code: "ENOSPC" });

  expect(getDownloadErrorDiagnostics(error)).toEqual({
    name: "Error",
    message: "write failed",
    code: "ENOSPC",
  });
});
