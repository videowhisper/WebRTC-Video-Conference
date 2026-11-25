=== VideoWhisper Video Conference ===
Contributors: videowhisper
Tags: video conference, webrtc, meetings, video chat
Requires at least: 6.9
Tested up to: 7.1
Requires PHP: 8.2
Stable tag: 0.7.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Small group video meetings with push to talk, screen sharing, chat and optional turnkey streaming setup.

== Description ==

Includes optional push to talk, camera/microphone selection, local device checks, connection diagnostics and configurable app defaults. Participants decide whether to use push to talk: hold the talk button, or focus it and hold Space/Enter, to speak; release to mute. Leaving the mode keeps the microphone muted until the participant unmutes it.

Configure a compatible server manually or use the optional VideoWhisper connection tab for turnkey streaming setup with a free testing account where offered, or an existing paid account. Existing contacts and new contacts have separate forms. Consent and provider terms apply; connecting is optional.

Access settings control site-wide room management and joining roles. Pages can create a frontend management page with [videowhisper_conference_manager]. Authorized managers can create, edit, invite and move rooms to Trash. App settings include signed participant capacity, initial layout/panel/theme, media and mute defaults, push to talk, screen-sharing button visibility and shortcode height.


Create and publish a meeting, then choose Open conference to use its own /conference/room-name/ frontend URL. Invite participants with a copyable link. Optionally embed [videowhisper_conference id="123"] on another page. Participants choose a display name and explicitly connect. Camera/microphone access is optional. Select devices before joining or switch them in a meeting; local checks help resolve permission or device errors. Connection diagnostics show aggregate decoded media counters, receive rate, latency and direct/TURN routing, with a copyable redacted report. Includes chat, screen sharing, gallery/speaker layouts, and host mute requests, spotlight and removal. Responsive panels stack below video on narrow screens. Theme controls support light, dark and the system preference (default). Raised hands are visible on participant tiles and in the people panel.

This edition uses peer-to-peer mesh for up to four participants. This is a technical browser/bandwidth safety limit, not a paid unlock. There is no recording, SFU, analytics or remote asset loading. CRM registration is optional and requires explicit administrator consent. Hosts are users authorized to manage the meeting. Access settings delegate conference-only permissions to selected roles for own rooms or all rooms; server credentials/settings remain administrator-only. Site-wide joining rules allow all signed-in users, selected roles, or visitors, while each room may impose stricter member/private-invitation rules. Defaults retain existing room access. New meetings require signed-in members by default. Choose Private for guest invitations containing a random access key, or Public for anyone with the room URL. Existing access settings are preserved. Private links are bearer capabilities: keep them confidential and replace the key in the meeting editor when needed. Key replacement applies to new connections; it does not disconnect participants already in a meeting.

A separately operated VideoWhisper signaling server with the conference extension is required. The plugin does not include media server infrastructure. Self-hosting is supported: https://github.com/videowhisper/videowhisper-webrtc .

== External services ==

= Optional VideoWhisper CRM connection =

The VideoWhisper connection tab optionally contacts https://consult.videowhisper.com/wp-json/video-live-support/v1/remote/ for registration, email-code login, owned account listing/creation and streaming settings retrieval. Opening this tab or activating the plugin makes no CRM request. Only an administrator's explicit POST action sends data. Loading the registration form sends network metadata; login/registration sends email, name where supplied, website URL, plugin identifier and selected answers after consent. Confirmation sends the email code; later actions send a server-side expiring contact session and selected account credential. These credentials never enter browser form fields, JavaScript or logs. The provider may create the testing account requested during registration confirmation under its current free-plan availability and quotas. No paid plan, trial bonus, billing action or Pro dependency is enabled by this plugin.

Import copies only the product's allowed streaming settings and refuses a different account callback. The separate Use account and configure callback action asks a compatible provider to verify this website using a short-lived signed challenge, then atomically configure an empty callback on the selected owned account. It never replaces another callback. It sends the callback URL, expected callback fingerprint, one-time nonce and proof key server-to-server over HTTPS; the public proof endpoint returns only the challenge signature while that administrator-approved request is pending. Fresh provider settings must confirm success before local import. An older provider requires manual callback setup; no legacy overwrite fallback is used. Disconnect removes the current administrator's local CRM session and retains imported manual settings, meetings and provider accounts; remote session retention and revocation follow provider policy. Support links include site/plugin details when opened. CRM terms and privacy policy:
https://www.videowhisper.com/view.php?p=Terms+of+Use
https://www.videowhisper.com/view.php?p=Privacy+Policy


= Administrator-configured VideoWhisper signaling server =

A separately operated VideoWhisper server is required to authenticate participants, exchange WebRTC connection information and deliver room events/chat. The administrator manually selects its HTTPS origin and account under Settings. There is no built-in default service account. Optional administrator-initiated CRM registration is described above. Activating the plugin, saving settings or viewing the entry form does not contact a signaling service.

Only after a participant checks the connection consent box and chooses Join meeting does the browser connect to that configured origin's /conference Socket.IO namespace. It sends the account name, a pseudonymous member/guest identifier, an expiring signed room credential, room identifier, chosen display name, chat, moderation/room events, and WebRTC session descriptions and ICE network candidates. The network connection exposes the participant's IP address and connection metadata to the provider. The server authenticates against this WordPress site's /wp-json/videowhisper-conference/v1/auth callback, sending the account token and room credential. The account token is never included in browser configuration. The configured server may retain account usage totals and operational diagnostics according to its operator's policy; the standard conference module holds chat in memory until the room empties.

The provider is selected by the site administrator. For VideoWhisper-operated hosting, the applicable terms and privacy policy are:
https://www.videowhisper.com/view.php?p=Terms+of+Use
https://www.videowhisper.com/view.php?p=Privacy+Policy
For self-hosted or other operated servers, the site owner must publish that operator's identity, endpoint, retention, terms and privacy policy to participants before enabling meetings. VideoWhisper policies do not cover independently operated servers.

= STUN/TURN connectivity services selected by the server operator =

After joining, the browser uses the ICE servers supplied by the configured signaling server to discover network routes and, where required, relay encrypted audio/video/screen media. STUN receives the participant's IP address, port and connection requests, not meeting chat or media. TURN receives connection metadata, relay credentials and encrypted media packets; it is used when the selected network path requires relaying. Participant browsers also receive session/network metadata and enabled media directly or through TURN. The application does not record media.

The plugin does not hard-code a STUN/TURN provider. The compatible VideoWhisper server can supply an operator-configured coturn server; without coturn configured, that server's default is Google's public STUN endpoint stun:stun.l.google.com:19302. This is conditional on the operator's server configuration, not an independent connection on plugin activation. For that Google service:
https://policies.google.com/terms
https://policies.google.com/privacy
For VideoWhisper-operated TURN, use the VideoWhisper terms/privacy links above. Other STUN/TURN providers require their own terms/privacy disclosure by the site owner. Server operators can replace the Google fallback with their own ICE configuration.

= Local storage and bundled libraries =

A signed HttpOnly session cookie identifies guests on this site. A browser preference stores the selected theme locally. Private invitation keys can appear in browser history or site access logs; meeting pages send no-referrer/no-store headers and request no indexing. Keep private invitations confidential. Browser credentials expire after one hour; reload to obtain another authorized session. Generic public post REST/search/oEmbed discovery does not expose meeting content.

There is no plugin analytics, remote script/font loading or automatic GitHub/Socket.IO documentation request. Socket.IO is bundled locally. Its socket.io documentation URL in a protocol-version error is informational text, not a contacted service. Ordinary documentation/support links are opened only if a user follows them.

== Source and translations ==

= Translations =

The plugin is internationalized with the videowhisper-video-conference text domain, including client labels supplied through WordPress gettext. Locale catalogs and development translation templates are not installed with this package. After directory publication, community translations can be supplied through translate.wordpress.org and standard WordPress language packs.

= Source and build =

The readable client, dependency lockfile and build tools are maintained in https://github.com/videowhisper/WebRTC-Video-Conference . Distributed plugin packages link their exact corresponding source commit and compiled-asset SHA256 hashes here. This source-preparation commit precedes the release metadata pin.

With Node.js22+, run npm ci and npm run build from the repository root. WordPress outputs are dist-wordpress/assets/conference.js and conference.css. PHP source is included directly in this edition. Runtime packages exclude development source, tests and translation catalogs.

 React is supplied by WordPress core through wp-element; it is not bundled a second time. PHP source is included directly in this plugin. No runtime executable assets are downloaded from GitHub or another CDN.

== Frontend room management ==

Under Settings > Access select roles that may create/manage their own rooms, roles that may manage all conference rooms, and site-wide joining eligibility. Private invitation keys never bypass site role restrictions. Users with Manage Options retain administrative management. Access changes invalidate previously issued join credentials but do not end an already established peer media session.

Under Settings > Pages select a published page containing [videowhisper_conference_manager], or explicitly create one. Authorized users can create, edit, open, invite and move rooms to Trash there. Other users do not see room listings. Enable the optional Video Conference section in the top-right user menu. Individual published rooms retain /conference/room-name/ URLs and their embed shortcode. These actions do not contact an external service.

== Installation ==

1. Install and activate on WordPress 6.9+ / PHP 8.2+.
2. Under Video Conferences > Settings enter the HTTPS signaling server origin, dedicated account name and token.
3. On the Node server enable the reviewed conference extension. Set this dedicated account's loginURL to the callback shown in Settings. Do not replace another integration's callback.
4. Create and publish a Video Conference. Choose Signed-in members, Private invitation with access key, or Public under Meeting access and invitations.
5. Use Open conference in the meeting list/editor, then Invite to copy its link. Open that same invitation in another browser; do not create a second room. The shortcode is optional.
6. Exclude /conference/* and admin-post.php?action=vwconf_app (and the legacy action=vwc_app route) from page caches. The app sends no-store headers. Test two separate browsers over HTTPS, set provider limits and configure TURN for cross-network use.

== Frequently Asked Questions ==

= Can I configure the meeting interface? =

The App tab lets administrators choose initial layout, panel, appearance and media defaults, a participant limit of two to four, screen sharing button visibility and shortcode height. Participants still consent before joining and can adjust their controls. Saved browser appearance takes priority. Everyone should leave and rejoin after a capacity change. Screen sharing visibility is a presentation setting, not a server access rule.


= Does activation connect to VideoWhisper? =
No. Configure manually. Participants explicitly consent before connecting to your chosen server.

= Can I use an existing server? =
Yes, after an operator reviews and enables the additive /conference namespace. Existing legacy endpoints remain separate. Never change a production server without a rollback plan.

= Does deactivation delete meetings? =
No. Settings and meetings are retained on deactivation and deletion. Remove them deliberately through WordPress before deleting the plugin if desired.

== Changelog ==

= 0.7.0 =
* Optional push to talk with a site default, participant choice and keyboard/touch controls; release, focus loss, reconnect and host mute close the microphone.
* Existing/New contact tabs, responsive account forms and bottom terms/privacy/support links.
* Optional turnkey setup linked from manual server settings.
* Includes App, Access and Pages settings, frontend room management, device selection, diagnostics and safe callback setup.


= 0.2.5 =
* Use the distinct vwconf prefix for PHP declarations, stored data, hooks and WordPress identifiers.
* Migrate existing demo settings and meetings without changing frontend invitation URLs or access policies.
* Remove development translation files from installation; retain internationalization and standard language-pack support.
* Document signaling and conditional STUN/TURN service use, transmitted data and provider policies.
* Harden malformed meeting editor and legacy URL handling.


= 0.2.4 =
* Keep the installable package limited to runtime and required licenses; link exact public client source and build instructions.
* Recheck current WordPress host permissions and deleted member accounts during new signaling authentication.
* Reject malformed settings input without overwriting the existing configuration.

= 0.2.3 =
* Center the entry form and prioritize your name, media choice, consent and Join meeting.
* Move invitations below Join meeting and remove the oversized inactive camera placeholder.
* Keep entry controls readable and accessible on narrow screens; support Enter to join.

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

= 0.7.0 =
Back up files and database. Rooms, invitations, server settings and access are retained. Push to talk is optional and off by default. Reload meeting tabs after updating; everyone should leave and rejoin after a capacity change.


= 0.2.5 =
Back up the database before updating. Settings and rooms migrate to vwconf identifiers; frontend invitations and legacy app links stay supported. To roll back, restore both the database backup and previous plugin ZIP.


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
