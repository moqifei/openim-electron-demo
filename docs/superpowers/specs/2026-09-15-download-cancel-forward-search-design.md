# Download Cancellation and Forward Search Design

## Goal

Allow a user to cancel an in-progress file download from either the file
message card or its progress notification. Make single-message forwarding and
merge forwarding open directly into a unified target search instead of first
requiring a manual choice between people, groups, and agents.

## Scope

This work is limited to the Electron renderer/main-process download path and
the forwarding target picker. It does not change server APIs, upload handling,
message history search, or non-forward uses of the general-purpose picker.

## Download Cancellation

`downloadFileWithProgress` will expose one active download operation to its
caller. That operation has a promise for its eventual result and a cancel
function. Cancelling is idempotent and produces a distinct cancellation result,
not a download-failure notification.

For the renderer XHR path, cancellation aborts the `XMLHttpRequest`. An abort
requested by the user must not start the existing native fallback. The file
message renderer keeps the active operation while its progress bar is visible,
then returns to its ordinary downloadable state when it ends.

For the Electron native fallback, the renderer assigns an operation ID and
sends a cancel IPC request. The main process destroys the request, closes the
destination write stream, removes its unfinished temporary output, and reports
the cancellation to the renderer. A cancellation that races with completion
must preserve a successfully completed file; it must never delete the final
saved file.

The progress notification's close control is an explicit cancellation action
while the transfer is active. The file card exposes the same action next to its
progress bar. Both actions call the same operation cancel function. Completed,
failed, and cancelled operations remove their active operation from component
state. Existing save, save-as, open, open-folder, and re-download behavior is
unchanged.

## Forward Target Search

`ForwardModal` receives a forward-only search mode for its embedded target
picker. On opening, the input is visible and focused without requiring the
user to select the enterprise-member, group, or agent entry first.

The search result set combines the existing data sources for people, groups,
and agents. Results retain their existing target identity fields so the current
forward and merge-forward sending code can continue consuming selected
`CheckListItem` values unchanged. The modal retains multi-select, explicit
confirmation, cancellation, and reset-on-close behavior.

The common picker keeps its current navigation-first behavior by default.
Create-group, group-invitation, and other consumers therefore do not acquire
the forward modal's initial search state or result aggregation.

## Tests and Acceptance Criteria

Tests are added before production changes and must show the expected
pre-implementation failure.

- Cancelling an active XHR download calls `abort`, settles once as cancelled,
  does not invoke native fallback, and clears the visible progress state.
- Cancelling an active native download reaches the main-process cancellation
  handler, terminates its request/stream, and removes only the temporary file.
- Closing an active download notification and pressing the file-card cancel
  action both invoke the same cancellation path.
- Opening either single forwarding or merge forwarding directly exposes and
  focuses search. A person, group, or agent query can be selected and confirmed
  with the existing target contract.
- The ordinary common picker still begins with its existing category choices.

Targeted contract tests, relevant browser tests, linting, and the production
build must pass before completion.

## Non-goals

- No remote message-history query or right-side history panel.
- No change to download destination selection or completed-file caching.
- No changes to upload cancellation.
- No redesign of target selection outside forwarding.
