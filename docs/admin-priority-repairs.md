# Admin priority repairs

The operations map creates popup elements with textContent rather than interpolating personal fields into HTML. Its iframe allows scripts without same-origin access, and invalid coordinates are excluded. Missing online status displays as unavailable rather than falsely showing offline. The backend projection still needs an explicit isOnline field; this change does not invent that value. Google Maps must be tested with the configured key restrictions in the isolated iframe.

Wallet top-ups keep a per-user operation intent in sessionStorage before sending. An uncertain retry or reload reuses the same key, amount and reason. A conflicting new operation is blocked until confirmation. A successful response clears the intent; missing or corrupted intent data fails closed. The top-up dialog is custom, keyboard-aware and restores focus. A synchronous lock prevents duplicate submissions. The backend amount limit is reflected in the UI. Storage errors stop sending. Do not manually clear a pending intent until its transaction is reconciled. Protection is scoped to the same browser tab/session, not independent top-ups across tabs/devices.

Recoverable 403/5xx responses are rejected to the caller instead of navigating away. An authenticated 401 for the current token dispatches session expiration and AuthProvider logs out. A late response for an old token cannot log out a new session.

Validation: wallet intent and API error regression checks, TypeScript and production build. Browser, Maps API and real wallet settlement verification remain pending. No backend authorization or payout state is changed.

Outstanding findings from the audit include registration permission alignment, action permissions, pagination, request races and other remaining native dialogs. These are follow-ups, not claimed complete by this change.
