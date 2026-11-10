=== VideoWhisper Video Conference ===
Contributors: videowhisper
Tags: video conference, webrtc, meetings, video chat
Requires at least: 6.9
Tested up to: 7.1
Requires PHP: 8.2
Stable tag: 0.2.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Small group video meetings on your site with screen sharing, chat and a manually configured VideoWhisper WebRTC server.

== Description ==

Create and publish a meeting, then choose Open conference to use its own /conference/room-name/ frontend URL. Invite participants with a copyable link. Optionally embed [videowhisper_conference id="123"] on another page. Participants choose a display name and explicitly connect. Camera/microphone access is optional. Includes chat, screen sharing, gallery/speaker layouts, and host mute requests, spotlight and removal. Responsive panels stack below video on narrow screens. Theme controls support light, dark and the system preference (default). Raised hands are visible on participant tiles and in the people panel.

This edition uses peer-to-peer mesh for up to four participants. This is a technical browser/bandwidth safety limit, not a paid unlock. There is no recording, SFU, CRM registration, analytics or remote asset loading. Hosts are WordPress users who can edit the meeting. New meetings require signed-in members by default. Choose Private for guest invitations containing a random access key, or Public for anyone with the room URL. Existing access settings are preserved. Private links are bearer capabilities: keep them confidential and replace the key in the meeting editor when needed. Key replacement applies to new connections; it does not disconnect participants already in a meeting.

A separately operated VideoWhisper signaling server with the conference extension is required. The plugin does not include media server infrastructure. Self-hosting is supported; optional managed hosting and setup assistance are available from https://webrtchost.com/ and https://consult.videowhisper.com/ .

= External services and privacy =

The browser contacts ONLY the administrator-configured signaling server when the participant checks consent and clicks Join meeting. It sends an expiring room-scoped credential, room identifier, display name, chat and WebRTC session/network metadata. The server calls this site's authentication callback using the configured account token. The account token stays server-side. No automatic CRM calls are made.

The configured service may retain account-level usage totals and operational diagnostics under its provider policy. Meeting content is not exposed through generic public post REST endpoints.

Media travels between participant browsers; configured TURN servers may relay it. Peers may learn network addresses. There is no application recording. Chat is held in server memory until the room empties. A signed, HttpOnly browser-session cookie identifies guests. A local browser preference stores the selected theme; it is not sent to VideoWhisper. Private access keys appear in invitation URLs and may be retained in browser history or site access logs; pages send no-referrer/no-store headers and are excluded from indexing. Do not forward a private invitation publicly. Browser credentials expire after one hour; reload to obtain another authorized session. Site owners must disclose their chosen signaling/TURN provider, retention and terms/privacy policy to participants. Self-hosted providers define their own terms. For VideoWhisper managed services see https://www.videowhisper.com/view.php?p=Terms+of+Use and https://www.videowhisper.com/view.php?p=Privacy+Policy before use.

= Bundled translations =

Romanian UI translations are included. The consent sentence retains the English fallback pending native review; other locales are not bundled yet. Bundled translations may be generated or reviewed by AI agents. They are provided as a starting point and should be reviewed for your site before use, especially billing, access and consent wording.

= Source and build =

Human-readable client source, lockfile and build instructions are included in source/. Build with Node.js 22+, npm ci, npm run build; copy dist-wordpress/assets into assets/. The plugin uses the WordPress wp-element dependency for React. PHP ticket source is in includes/tickets.php. All runtime assets are bundled locally. See SOURCE.txt and THIRD-PARTY-NOTICES.txt.

== Installation ==

1. Install and activate on WordPress 6.9+ / PHP 8.2+.
2. Under Video Conferences > Settings enter the HTTPS signaling server origin, dedicated account name and token.
3. On the Node server enable the reviewed conference extension. Set this dedicated account's loginURL to the callback shown in Settings. Do not replace another integration's callback.
4. Create and publish a Video Conference. Choose Signed-in members, Private invitation with access key, or Public under Meeting access and invitations.
5. Use Open conference in the meeting list/editor, then Invite to copy its link. Open that same invitation in another browser; do not create a second room. The shortcode is optional.
6. Exclude /conference/* and legacy admin-post.php?action=vwc_app from page caches. The app sends no-store headers. Test two separate browsers over HTTPS, set provider limits and configure TURN for cross-network use.

== Frequently Asked Questions ==

= Does activation connect to VideoWhisper? =
No. Configure manually. Participants explicitly consent before connecting to your chosen server.

= Can I use an existing server? =
Yes, after an operator reviews and enables the additive /conference namespace. Existing legacy endpoints remain separate. Never change a production server without a rollback plan.

= Does deactivation delete meetings? =
No. Settings and meetings are retained on deactivation and deletion. Remove them deliberately through WordPress before deleting the plugin if desired.

== Changelog ==

= 0.2.1 =
* Keep shared source/release editions synchronized with the PHP Unicode room-title fix.

= 0.2.0 =
* Add frontend conference URLs and Open conference links in the meeting list/editor.
* Add explicit member/public/private access and copyable invitation links with private access keys.
* Explain missing sign-in/access keys before joining; retain existing access defaults.
* Stack chat/people/invitations below media on narrow screens, show raised-hand feedback, and add light/dark/system themes.

= 0.1.3 =
* Use WordPress core React through wp-element rather than bundling a second renderer.

= 0.1.2 =
* Keep member-only meeting content out of generic public post REST endpoints.
* Correct muted camera/microphone indicators when joining without media and keep the meeting timer current.
* Tested with VideoWhisper server 2026.11.10 and its conference namespace.

= 0.1.1 =
* Show a clear setup notice and administrator settings link instead of an empty meeting frame when the server is unconfigured.

= 0.1.0 =
* Initial development candidate: manual configuration, meeting access and small-room conferencing.

== Screenshots ==

1. Four-participant conference gallery using synthetic test media.
2. Responsive mobile meeting with chat below the video.

== Upgrade Notice ==

= 0.2.0 =
Existing access settings are retained. New frontend URLs and invitations simplify joining. Reload existing app tabs after updating; credentials are bound to the current meeting access policy. Older 0.1.x releases do not support private access keys: unpublish private-key rooms before any downgrade.

= 0.1.3 =
Uses the WordPress core renderer for compatibility and directory compliance.

= 0.1.2 =
Use server 2026.11.10 or later with conference support enabled. Improves joining without camera/microphone.

= 0.1.1 =
Improves the unconfigured meeting experience. Server patch approval is still required before live media testing.

= 0.1.0 =
Initial development candidate. Review server compatibility and release readiness before public deployment.
