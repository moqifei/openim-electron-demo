# Upload File Size Limit Design

## Goal

Prevent client-side uploads larger than 200 MiB and show the user a localized warning before an upload request begins.

## Scope

The limit applies to every user-selected file that is uploaded through `uploadObjectFile`, including chat attachments, chat images, personal avatars, group avatars, and group-creation avatars.

The limit is 200 MiB, defined as `200 * 1024 * 1024` bytes. A file exactly 200 MiB is accepted. A file larger than that is rejected.

## Design

`src/utils/objectUpload.ts` will expose the shared limit and a pure predicate for checking a file size. This keeps the byte threshold in one location and makes the boundary behavior directly testable.

`src/api/imApi.ts` will check the size at the start of `uploadObjectFile`, after the existing invalid and empty-file checks and before it constructs a `FormData` object, invokes Electron native upload, or starts a browser upload request. For an oversized file it will show a localized global warning and throw an error to stop the existing caller flow.

This central check covers all current user-selected upload flows that call `uploadObjectFile`, without duplicating validation in individual page components.

## User Feedback

Add a size-limit message to the Chinese and English i18n resources. The upload API will use the project global Ant Design message API to display that warning immediately. Existing callers may continue handling the thrown error as they do today; no upload task or network request will have started.

## Exclusions

SDK-managed log reporting does not expose a client-side file object to inspect before upload. The internally downloaded digital-twin skill ZIP uses a separate endpoint rather than the shared user-selected object-upload flow. Both remain unchanged in this focused modification.

## Verification

Extend `scripts/objectUpload.test.cts` before production code changes. The tests will verify that a size exactly at the limit is accepted and a size one byte above it is rejected. After implementation, run the focused script and the project type-check or build command available in the repository.
