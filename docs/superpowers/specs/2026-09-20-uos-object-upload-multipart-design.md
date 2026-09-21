# UOS Object Upload Multipart Design

## Goal

Keep native streaming upload as the primary path while making UOS multipart truncation observable and recovering from the confirmed `unexpected EOF` response through the existing renderer upload path.

## Diagnosis

The server returns HTTP 400 with `errCode: 1001` and `parse multipart form failed: unexpected EOF` before it reads the file part. The server reports the request `Content-Length` and outer multipart `Content-Type`, so the client declared a request size but the multipart body did not finish.

## Behavior

- Native upload records the source file size, expected multipart size, file-stream bytes, form bytes, lifecycle state, and operation ID. It never records file content or tokens.
- Native upload returns its original response for all outcomes.
- The renderer retries through browser `FormData` exactly once only when native upload returns `errCode: -1` and an error message containing `parse multipart form failed: unexpected EOF`.
- Any other native error remains an error and does not fall through to browser upload.

## Verification

- Unit-test the narrow fallback predicate for matching and nonmatching errors.
- Unit-test upload diagnostics byte counters independently of Electron.
- Run the existing object-upload diagnostic and behavior scripts, then build the application.
