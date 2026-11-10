# Standalone PHP edition

Deploy this directory with PHP 8.2+ over HTTPS after building the shared client. Configure VWC_SOCKET_URL, VWC_ACCOUNT, VWC_ACCOUNT_TOKEN, VWC_SIGNING_KEY (32+ random characters) and VWC_STORAGE_DIR (writable, outside the document root). No default production account is provided.

Set the dedicated Node account loginURL to this directory's `?action=auth` URL. Enable and review the additive /conference module first. Never replace a callback belonging to another solution.

The demo defaults to ten new rooms/browser/hour, sixty/IP/hour, twenty unexpired room reservations and four participants/room. Rooms expire after one hour or five minutes without page/presence activity; active participants refresh presence every twenty seconds. Idle/expired records are pruned under the private JSON ledger lock on page/presence requests, and authentication rejects expired reservations. Limits return a clear reason and a Retry-After header; existing invitations remain joinable when only creation is rate-limited. Optional private environment overrides: VWC_SESSION_ROOMS_PER_HOUR (1–100), VWC_IP_ROOMS_PER_HOUR (1–600), VWC_MAX_ROOMS (1–200), VWC_ROOM_IDLE_SECONDS (1–3600). The browser rate supplements the broader shared-IP cap; add edge protection because clearing cookies can reset browser identity. Room titles and guest display names are generated and editable; consent remains explicit. Use an edge rate limit and periodic cleanup for public demos. The creating browser session is host; share the room link with separate browser profiles. No recording or analytics is included. Configure TURN for cross-network media and disclose the selected provider's privacy/terms. PHP does not relay media.

Full source/build/test and release instructions are in the repository README and docs/. The project is GPL-2.0-or-later; third-party licenses remain applicable.

## Invitations and room access

Create a room once, choose private/public, then use the lobby or meeting Invite controls to copy the same link for every participant. A second Create action makes a separate room. Private links include a random access key; the private ledger retains its hash and the host's browser session retains its invitation. Guests can paste a complete invitation or enter room/key separately. Keep private links out of screenshots/log exports.

The public directory includes only public rooms with an admitted browser sending presence heartbeats (20 seconds, stale after60 seconds, bounded16 recent identities per room). No private room is listed. This is approximate presence, not an attendance/billing record. Room titles, hashed browser identity, access-key hashes and last-presence timestamps live only in the private ledger and expire with the room. Theme preference uses local browser storage; system mode is default. Deploy setup.js and theme.js alongside index.php/setup.css/includes/assets.
