import assert = require("assert");

const { AxiosHeaders } = require("axios");

const {
  getObjectUploadErrorDetails,
  getObjectUploadErrorMessage,
  getObjectUploadStreamDiagnostics,
} = require("../electron/main/objectUploadDiagnostics");

const details = getObjectUploadErrorDetails({
  name: "AxiosError",
  message: "Request failed with status code 400",
  code: "ERR_BAD_REQUEST",
  response: {
    status: 400,
    statusText: "Bad Request",
    data: { errCode: 1001, errMsg: "invalid upload" },
    headers: {
      "content-type": "application/json",
      server: "nginx",
      "x-request-id": "request-123",
      "set-cookie": "must-not-be-logged",
    },
  },
});

assert.deepEqual(details, {
  name: "AxiosError",
  message: "Request failed with status code 400",
  code: "ERR_BAD_REQUEST",
  status: 400,
  statusText: "Bad Request",
  response: '{"errCode":1001,"errMsg":"invalid upload"}',
  responseHeaders: {
    "content-type": "application/json",
    server: "nginx",
    "x-request-id": "request-123",
  },
});

const truncated = getObjectUploadErrorDetails({
  response: { data: "x".repeat(1100) },
});
assert.equal(truncated.response?.length, 1024);

const axiosHeaders = getObjectUploadErrorDetails({
  response: {
    headers: AxiosHeaders.from({
      "content-type": "application/json",
      "x-request-id": "request-456",
    }),
  },
});
assert.deepEqual(axiosHeaders.responseHeaders, {
  "content-type": "application/json",
  "x-request-id": "request-456",
});

assert.equal(
  getObjectUploadErrorMessage({
    message: "Request failed with status code 400",
    response: { data: { errCode: 1001, errMsg: "文件内容不合法" } },
  }),
  "文件内容不合法",
);
assert.equal(
  getObjectUploadErrorMessage({ response: { data: "gateway rejected upload" } }),
  "gateway rejected upload",
);

assert.deepEqual(
  getObjectUploadStreamDiagnostics({
    expectedMultipartLength: 100,
    readStreamBytes: 80,
    multipartBytes: 100,
    readStreamEnded: true,
    formEnded: true,
  }),
  {
    expectedMultipartLength: 100,
    readStreamBytes: 80,
    multipartBytes: 100,
    multipartComplete: true,
    readStreamEnded: true,
    formEnded: true,
  },
);

assert.deepEqual(
  getObjectUploadStreamDiagnostics({
    expectedMultipartLength: 100,
    readStreamBytes: 79,
    multipartBytes: 99,
    readStreamEnded: false,
    formEnded: false,
  }),
  {
    expectedMultipartLength: 100,
    readStreamBytes: 79,
    multipartBytes: 99,
    multipartComplete: false,
    readStreamEnded: false,
    formEnded: false,
  },
);

console.log("objectUploadDiagnostics tests passed");
