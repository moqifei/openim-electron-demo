# Upload File Size Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject every user-selected object upload above 200 MiB before the client creates an upload request, and show a localized warning.

**Architecture:** Keep the byte threshold and its pure predicate in `objectUpload.ts`, then apply the predicate once at the public `uploadObjectFile` boundary. That boundary is shared by chat attachments and avatar uploads, so UI components need no individual changes. The API boundary displays the global Ant Design warning and throws before native or browser upload execution.

**Tech Stack:** TypeScript, React, Ant Design global message API, i18next resources, Node `assert`, `ts-node`, Vite.

## Global Constraints

- Limit: exactly `200 * 1024 * 1024` bytes; a 200 MiB file is allowed and a larger file is rejected.
- Scope: user-selected uploads that call `uploadObjectFile`; do not change SDK-managed log reporting or the separate internal digital-twin ZIP request.
- Feedback: use the project global Ant Design message API and i18n key `toast.fileSizeExceedsLimit`.
- Guard ordering: check the size after the existing unreadable/empty-file guard and before `FormData`, Electron IPC, or HTTP upload work.
- Git: stage implementation files when verification passes; do not create a commit.

---

### Task 1: Define and Test the Shared Size Boundary

**Files:**

- Modify: `scripts/objectUpload.test.cts`
- Modify: `src/utils/objectUpload.ts`

**Interfaces:**

- Produces: `MAX_OBJECT_UPLOAD_FILE_SIZE: number`, equal to `200 * 1024 * 1024`.
- Produces: `isObjectUploadFileSizeAllowed(fileSize: number): boolean`.
- Consumes: no application state or browser APIs.

- [ ] **Step 1: Write the failing boundary assertions**

Add the two exported values to the existing `require` destructuring in `scripts/objectUpload.test.cts`, then append:

```ts
assert.equal(MAX_OBJECT_UPLOAD_FILE_SIZE, 200 * 1024 * 1024);
assert.equal(isObjectUploadFileSizeAllowed(MAX_OBJECT_UPLOAD_FILE_SIZE), true);
assert.equal(isObjectUploadFileSizeAllowed(MAX_OBJECT_UPLOAD_FILE_SIZE + 1), false);
```

- [ ] **Step 2: Run the focused test and verify it fails because the new exports are missing**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/objectUpload.test.cts
```

Expected: failure stating that `MAX_OBJECT_UPLOAD_FILE_SIZE` or `isObjectUploadFileSizeAllowed` is undefined.

- [ ] **Step 3: Add the smallest shared implementation**

At the top of `src/utils/objectUpload.ts`, add:

```ts
export const MAX_OBJECT_UPLOAD_FILE_SIZE = 200 * 1024 * 1024;

export const isObjectUploadFileSizeAllowed = (fileSize: number) =>
  Number.isFinite(fileSize) && fileSize <= MAX_OBJECT_UPLOAD_FILE_SIZE;
```

Do not change the existing object-name or native-upload helpers.

- [ ] **Step 4: Re-run the focused test and verify it passes**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/objectUpload.test.cts
```

Expected: `objectUpload tests passed` and exit code 0.

- [ ] **Step 5: Stage only the completed boundary files**

Run:

```powershell
git add -- scripts/objectUpload.test.cts src/utils/objectUpload.ts
```

Expected: the two files are staged; do not commit.

### Task 2: Stop Oversized Uploads and Display a Localized Warning

**Files:**

- Modify: `src/api/imApi.ts`
- Modify: `src/i18n/resources/zh.json`
- Modify: `src/i18n/resources/en.json`

**Interfaces:**

- Consumes: `MAX_OBJECT_UPLOAD_FILE_SIZE` and `isObjectUploadFileSizeAllowed(fileSize)` from `src/utils/objectUpload.ts`.
- Consumes: `message` exported from `src/AntdGlobalComp.tsx` and `t` from `i18next`.
- Produces: an early rejected `uploadObjectFile` call for a file whose `size` is greater than `MAX_OBJECT_UPLOAD_FILE_SIZE`.

- [ ] **Step 1: Specify the warning behavior with a focused source-level assertion**

Extend `scripts/objectUpload.test.cts` with the intended predicate assertion already added in Task 1. The `uploadObjectFile` function depends on browser `File`, global Ant Design app context, network clients, and user store state, so keep its behavior covered by the pure boundary test plus a production build rather than mocking those runtime services.

- [ ] **Step 2: Run the focused test before integration code**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/objectUpload.test.cts
```

Expected: PASS, proving the size policy is available before it is connected to the upload boundary.

- [ ] **Step 3: Add i18n text and the central guard**

In each locale's `toast` object, add the same key:

```json
"fileSizeExceedsLimit": "文件大小不能超过200M！"
```

```json
"fileSizeExceedsLimit": "File size cannot exceed 200 MB!"
```

In `src/api/imApi.ts`:

```ts
import { message as antdMessage } from "@/AntdGlobalComp";
import { t } from "i18next";
```

Extend the existing `@/utils/objectUpload` import with `isObjectUploadFileSizeAllowed`. Immediately after the existing empty/unreadable-file `if` block in `uploadObjectFile`, add:

```ts
if (!isObjectUploadFileSizeAllowed(file.size)) {
  antdMessage.warning(t("toast.fileSizeExceedsLimit"));
  throw new Error("File size exceeds 200 MiB");
}
```

This placement must remain before `useUserStore`, `buildObjectUploadName`, `FormData`, native IPC, and `request.post` work.

- [ ] **Step 4: Verify focused behavior and compile the application**

Run:

```powershell
node --require ts-node/register/transpile-only scripts/objectUpload.test.cts
npm run build
```

Expected: the focused script prints `objectUpload tests passed`; Vite completes with exit code 0.

- [ ] **Step 5: Inspect the final diff and stage only implementation files**

Run:

```powershell
git diff --check
git add -- src/api/imApi.ts src/i18n/resources/zh.json src/i18n/resources/en.json
git status --short
```

Expected: no whitespace errors; the three implementation files and Task 1 files are staged, with no `git commit` command run.
