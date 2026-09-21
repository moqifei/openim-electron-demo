# UOS Object Upload Multipart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose native UOS multipart stream completion and recover only from the confirmed server EOF response.

**Architecture:** The main process measures the existing `fs.createReadStream` and `form-data` output without changing its transport. A renderer helper classifies the native response, allowing the existing browser `FormData` upload loop to run once only for the server's multipart EOF response.

**Tech Stack:** Electron main process, Node streams, Axios, form-data, TypeScript assertion scripts.

## Global Constraints

- Preserve native streaming upload as the default path.
- Do not log upload content or authentication tokens.
- Do not fall back for authentication, validation, or arbitrary HTTP errors.

---

### Task 1: Classify the Recovery Condition

**Files:**

- Modify: `src/utils/objectUpload.ts`
- Modify: `scripts/objectUpload.test.cts`

**Interfaces:**

- Produces: `shouldFallbackFromNativeObjectUpload(response)` returning a boolean.

- [ ] **Step 1: Write the failing test**

```ts
assert.equal(
  shouldFallbackFromNativeObjectUpload({
    errCode: -1,
    errMsg: "parse multipart form failed: unexpected EOF",
  }),
  true,
);
assert.equal(
  shouldFallbackFromNativeObjectUpload({ errCode: -1, errMsg: "token expired" }),
  false,
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only scripts/objectUpload.test.cts`

Expected: failure because the classifier is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
export const shouldFallbackFromNativeObjectUpload = (response: {
  errCode?: number;
  errMsg?: string;
}) =>
  response.errCode === -1 &&
  response.errMsg?.includes("parse multipart form failed: unexpected EOF");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only scripts/objectUpload.test.cts`

Expected: `objectUpload tests passed`.

### Task 2: Measure the Native Multipart Stream

**Files:**

- Modify: `electron/main/ipcHandlerManage.ts`
- Modify: `scripts/objectUploadDiagnostics.test.cts`

**Interfaces:**

- Produces: native upload logs containing `expectedMultipartLength`, `readStreamBytes`, `multipartBytes`, and stream lifecycle state.

- [ ] **Step 1: Write a failing test for diagnostic byte aggregation**

```ts
assert.deepEqual(
  getObjectUploadStreamDiagnostics({
    expectedMultipartLength: 20,
    readStreamBytes: 10,
    multipartBytes: 20,
  }),
  {
    expectedMultipartLength: 20,
    readStreamBytes: 10,
    multipartBytes: 20,
    multipartComplete: true,
  },
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only scripts/objectUploadDiagnostics.test.cts`

Expected: failure because the helper is not exported.

- [ ] **Step 3: Implement the diagnostic helper and attach listeners before Axios starts the form stream**

```ts
const expectedMultipartLength = await new Promise<number>((resolve, reject) =>
  form.getLength((error, length) => (error ? reject(error) : resolve(length))),
);
readStream.on("data", (chunk) => {
  readStreamBytes += chunk.length;
});
form.on("data", (chunk) => {
  multipartBytes += Buffer.byteLength(chunk);
});
```

- [ ] **Step 4: Run diagnostic test to verify it passes**

Run: `node --require ts-node/register/transpile-only scripts/objectUploadDiagnostics.test.cts`

Expected: `objectUploadDiagnostics tests passed`.

### Task 3: Recover Through Browser FormData

**Files:**

- Modify: `src/api/imApi.ts`
- Test: `scripts/objectUpload.test.cts`

**Interfaces:**

- Consumes: `shouldFallbackFromNativeObjectUpload`.
- Produces: one browser upload attempt after only the known native multipart EOF response.

- [ ] **Step 1: Make the recovery test fail**

Run: `node --require ts-node/register/transpile-only scripts/objectUpload.test.cts`

Expected: the fallback classifier test passes only after Task 1; native upload still throws every nonzero response.

- [ ] **Step 2: Implement the minimal fall-through**

```ts
if (!shouldFallbackFromNativeObjectUpload(nativeResponse)) {
  throw nativeResponse;
}
console.warn(
  "[uploadObjectFile] native multipart EOF; retrying in renderer",
  stringifyLogMeta(uploadMeta),
);
```

- [ ] **Step 3: Run focused scripts and build**

Run: `node --require ts-node/register/transpile-only scripts/objectUpload.test.cts`

Run: `node --require ts-node/register/transpile-only scripts/objectUploadDiagnostics.test.cts`

Run: `npm run build`

Expected: both scripts pass and build exits with code 0.
