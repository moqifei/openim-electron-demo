# Chat Screenshot and Mention Design

## Goal

Improve three chat-client interactions:

1. Show the exact Chinese warning `上传文件大小不得超过200M` when a selected upload exceeds the existing 200 MiB limit.
2. Remove the screenshot selection preview defect where areas inside the selected region appear as mismatched white and gray blocks even though the saved image is correct.
3. Provide a group-chat avatar-hover mention action without showing the message action toolbar while the pointer is over an avatar.

## Scope

### Upload warning

Keep the existing shared 200 MiB client-side file-size validation and its boundary behavior. Only update the Chinese `toast.fileSizeExceedsLimit` resource to the approved copy. English copy and upload transport behavior are out of scope.

### Screenshot selection

The current Electron main-process screenshot flow first opens the `electron-screenshots` selection overlay. That package composites a full-screen screenshot, a translucent mask, and a second screenshot inside the selection. On some display scale, multi-display, or GPU-compositing combinations, those layers are misaligned, producing the visual white/gray blocks shown in the report. The exported selection remains correct because it uses the original capture buffer.

Remove the third-party selection-overlay path from the application flow. Continue capturing the focused display at native resolution with the existing native monitor capture and Electron thumbnail fallback. Return that image to the renderer as a full screenshot, then present the existing `ScreenshotCropper` for selection, annotation, confirmation, and saving. Its preview has one image canvas and its outside-selection mask is drawn in the same canvas, so it cannot expose the external package's misaligned duplicate image layer.

Retain the existing hide-current-window preference and restore the main window after capture. Do not alter screenshot file encoding, clipboard handling, or pending-file insertion after confirmation.

### Avatar mention and message actions

In group conversations only, hovering a message avatar shows a compact, icon-only `@` button on the avatar's left. The control has an accessible label and tooltip. It is hidden for the current user's own messages and for one-to-one conversations, where a member mention has no meaningful target.

Clicking the button stops message-row click propagation and dispatches the sender information to the chat footer. The footer reuses its existing group-member list and `@` insertion pipeline so the selected sender is inserted into the editor as a normal tracked mention. The implementation must ensure the popup and mention metadata remain consistent with a manually typed `@` mention.

The existing message action toolbar changes from row-hover state to message-content-hover state. Hovering an avatar therefore shows only the avatar mention button, while hovering the rendered message content shows reply, forward, copy, multi-select, and revoke actions as currently permitted.

## Alternatives Considered

1. Replace the external screenshot overlay with the existing renderer cropper. Chosen because it removes the defective multi-layer composition while retaining the current capture, crop, annotation, clipboard, and file-send behavior.
2. Patch the third-party screenshot overlay. Rejected because its relevant layers are internal to a packaged dependency, it exposes no configuration for their geometry, and a patch would remain sensitive to scaling and GPU conditions.
3. Upgrade the third-party screenshot overlay. Rejected because the installed version is current for the package line and the fundamental multi-layer rendering design remains.

## Testing and Verification

Add focused regression checks before implementation changes where the repository's current test patterns permit it.

- Assert the Chinese upload-limit resource contains the approved warning copy while the existing 200 MiB predicate boundary tests remain green.
- Assert the screenshot IPC flow no longer initializes or starts `electron-screenshots`, still captures a display image, and returns `isSelection: false` for the renderer cropper path.
- Assert group-chat message items render an accessible avatar mention control for other users, do not render it for self or private chats, and route its click to the existing footer mention flow.
- Assert avatar hover does not satisfy the message action toolbar hover condition, while content hover does.
- Run focused scripts plus the project's lint or build command, then manually exercise screenshot selection at a non-100% display scale if an Electron desktop session is available.

## Exclusions

Do not modify existing uncommitted upload diagnostics, upload retry behavior, unrelated chat message rendering, private-chat semantics, or the third-party dependency source.
