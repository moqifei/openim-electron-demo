# Startup Server Environment Reset

## Goal

Every full client launch must discard the previous process's server selection
and manual IP override, then detect a reachable configured environment before
logging in. During one running client process, an IP saved from the server
configuration dialog remains effective for subsequent manual logins.

## State

The startup reset removes these local-storage keys:

- `openim_manual_server_host`
- `openim_im_host`
- `openim_chat_host`
- `openim_server_environment`

The reset does not touch remembered credentials, login tokens beyond the
existing startup flow, or other application settings. A full client launch
creates a new renderer process, so it has no prior in-memory environment
selection to clear.

## Flow

1. `MainContentWrap` runs once for a newly launched renderer process.
2. Before navigating to `/login`, it resets prior server-environment state.
3. The login path calls `ensureServerEnvironmentSelected(true)`.
4. With no manual marker, the client probes configured environments and saves
   the selected environment's configured IM and Chat domain names.
5. If the user logs out in this process and saves an IP through `ServerConfig`,
   the manual marker is restored. Later logins in this process use those hosts
   without probing.

## Verification

Automated checks cover that the startup-reset helper removes all four server
keys and that the startup wrapper calls it before navigating to the login page.
They also preserve the existing assertion that manual save establishes the
manual-override marker used by environment selection.
