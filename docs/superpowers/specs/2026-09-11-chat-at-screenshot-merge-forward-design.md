# Chat @, Screenshot, and Merge Forward Design

## Goal

Fix the group-chat @ member picker navigation and dismissal behavior, restore the
optional screenshot window-hiding behavior, and make merge-forwarded records
faithfully copyable and stable.

## Scope

This work is limited to the existing chat footer, screenshot IPC path, message
merge creation, and merge-record detail rendering. It does not change the
message protocol, server APIs, screenshot capture implementation, or the
ordinary message-list UI.

## @ Member Picker

`AtMemberPopup` currently binds the same keyboard handler to both the search
input and its popup container. A key event originating in the input bubbles to
the container, so one arrow-key press increments or decrements the active row
twice. The input will become the only keyboard handler for member navigation,
selection, and Escape cancellation.

The footer owns popup lifetime:

- A document pointer listener closes the popup when its portal container is not
  the event target or an ancestor of the target.
- A conversation-ID effect closes the popup, clears its member list, and
  invalidates outstanding member-list requests when the user changes chats.
- Closing a popup invalidates the request ID so a delayed response cannot
  reopen it in the new conversation.

The existing filter, pinyin search, @everyone row, and editor insertion rules
remain unchanged.

## Screenshot Window Visibility

Restore the screenshot action menu's `screenshotHideWindow` checkbox. It is a
renderer preference stored in `localStorage`, defaults to enabled when unset,
and is passed with every button and global-shortcut screenshot request.

The `startScreenshot(hideWindow)` IPC contract is restored through the preload
bridge and TypeScript declaration. The main process calculates a
`hiddenForCapture` flag only when all of the following are true:

- the option is enabled;
- a currently focused BrowserWindow exists; and
- that window is visible and not destroyed.

Only then does it hide the window before capture and restore/focus it after
capture. When the option is disabled, or the client is already in the
background and has no focused window, the screenshot flow must never call
`show`, `restore`, or `focus`. Capture still chooses the focused window's
display when available and otherwise uses the cursor display.

## Merge Forwarding and Detail Copy

When the user presses merge-forward, the selected `MessageItem` list is
serialized immediately into a deep snapshot. The title, summary list, and
`createMergerMessage` input all use this same snapshot. This prevents pending
target selection, incoming-message updates, or mutable SDK objects from
changing the record that is ultimately sent.

The merge-record detail modal explicitly opts into text selection because the
application global style disables it by default. Text messages use the same
plain-text, whitespace-preserving rendering approach as ordinary message items,
so selecting and copying yields the original message text rather than generated
HTML.

Image entries retain click-to-preview behavior and add a hover copy action. The
action reuses `copyImageToClipboard`, which writes through Electron's native
image clipboard bridge when available and falls back to the browser Clipboard
API. It reports the existing copy success/failure feedback.

In development builds, a compact ID-only check compares the selected snapshot
with the merge message returned by the SDK when that data is available. It does
not log message text, media URLs, user identifiers, or other message content.

## Tests and Acceptance Criteria

Tests are added before implementation and must demonstrate the pre-fix failure.

- A @ picker key press advances exactly one row. Escape, external pointer
  interaction, conversation change, and a stale group-member response all close
  or keep closed the popup.
- Screenshot settings default to hiding the focused window. Enabled capture
  hides and restores that focused window; disabled or background capture never
  foregrounds the client.
- Merge creation receives the exact frozen selection snapshot. Merge details
  expose selectable text and copy image bytes through the established clipboard
  helper.

Targeted contract tests, the affected Playwright tests, linting, and the
production build must pass before the work is considered complete.

## Non-goals

- No new screenshot window, capture backend, or server endpoint.
- No persistent global UI state for the @ picker.
- No arbitrary message export or rich-text whole-record clipboard format.
- No changes to unrelated, already-uncommitted download work.
