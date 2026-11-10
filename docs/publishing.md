# Publish the Free conference editions

Owner: VideoWhisper. Candidate: 0.2.0. Audience: small groups and WordPress site owners. The live development demo is https://demo.videowhisper.com/video-conference/ . The shared server must be version 2026.11.10+ with the conference namespace enabled. This is four-person P2P mesh, with no SFU or recording.

## Verify the release

Run npm ci, npm run lint, npm test, npm run test:server, npm run test:php, npm run build, npm run test:e2e, npm run package. Keep dependencies in a no-sync directory when working in iCloud. The local browser fixture uses random synthetic credentials and never reads production configuration. A separate deployment check must prove real HTTPS callbacks, two-way decoded video, screen-share end, chat, host controls, leave/rejoin and TURN on the chosen server. Complete physical-device/two-network checks before describing the product as generally validated.

The runtime and public-source exports are explicit allowlists. Inspect the ZIP listing/checksum. No configuration, account tokens, PINs, private server review files, staging evidence, logs, dependencies, maps or private development plans belong in either export. WordPress bundles readable source, lockfile and build instructions. Install the exact plugin ZIP, run Plugin Check including i18n_usage, and validate its exact readme with the official validator. Preserve the exact archive used for review and rollback.

## Publish the new GitHub repository

1. Use release/WebRTC-Video-Conference/ as the clean source export. Do not initialize Git in the private development tree or copy its public/config.json. Review LICENSE, notices, README and tests.
2. Create videowhisper/WebRTC-Video-Conference at https://github.com/new (select the `videowhisper` owner) . Use GPL-2.0-or-later, the verified PHP demo as website, and a description stating small-room self-hostable WebRTC conferencing.
3. In the clean export, initialize a main branch, add only reviewed files, commit, add the new origin and push. Tag v0.2.0 and create a release containing WebRTC-Video-Conference-0.2.0.zip and its SHA256. Verify a clean clone can npm ci/build and run the synthetic tests.
4. The current client can be published with its isolated local test harness and a clear server prerequisite. The managed demo has the conference extension; the corresponding public server source release is still being prepared. Do not imply the older public server main branch already includes conferencing or that every clone is a ready production server. Managed server availability is a separate option, not an account requirement for the software.
5. Retain the historical PHP-Webcam-Video-Conference repository and its old instructions. After the new repository works, propose a successor notice and archive policy; do not silently replace its code.

Deploy only editions/php runtime files to an HTTPS path. Configure VWC_SOCKET_URL, VWC_ACCOUNT, VWC_ACCOUNT_TOKEN, VWC_SIGNING_KEY and VWC_STORAGE_DIR privately outside the webroot. Each edition needs a dedicated account callback; never overwrite an existing Broadcast/PPV/VideoCalls callback. The demonstration limits room creation, participants and expiry. Add provider/edge abuse controls, cleanup and a named support owner. Retain a directory/config snapshot for rollback; changing the new demo must not alter existing demos or their credentials.

## Submit the WordPress Free plugin

1. The permanent proposed slug/text domain is videowhisper-video-conference. Use release/videowhisper-video-conference-0.2.0.zip. Review the [directory guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/), [submission instructions](https://developer.wordpress.org/plugins/wordpress-org/planning-submitting-and-maintaining-plugins/) and [developer FAQ](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/).
2. Check the submitting author's live queue; generally only one new plugin may be under review. Tutor LMS was approved in August; still check the live author queue and coordinate Conference/Elementor submissions before uploading. Confirm the company-owned account/email and plugin-name ownership.
3. Review server/provider disclosures, participant consent, no-store responses, guest defaults, optional service links, complete Free functionality, bundled source/licenses and localization. The technical four-person limit is explicit, not a paid unlock. CRM registration is deferred; there are no hidden Pro features or automatic external calls on activation.
4. Complete clean install/upgrade and minimum/current WordPress/PHP checks, Plugin Check, [official readme validation](https://wordpress.org/plugins/developers/readme-validator/) and real browser/device checks. Use authentic synthetic-media screenshots. A development preview alone is not directory production-readiness evidence.
5. The owner uploads the reviewed ZIP at https://wordpress.org/plugins/developers/add/ and completes each attestation after checking it. Do not claim submission/approval until the receipt/moderator result exists. Record exact ZIP SHA, approved slug, correspondence and later SVN revision privately. Reply to the original review email when changes are requested.
6. After approval, export only runtime/source/readme/languages/notices into SVN trunk; keep ZIPs, tests, private docs and local configuration out. Place listing images under SVN assets. Follow the workspace's Stable tag policy for published releases.

The plugin is manually configured under Video Conferences > Settings. Its callback is shown there. Published meetings use frontend conference URLs and Open conference actions; choose member/public/private access and share the complete invitation. Private URLs contain a bearer access key. Preserve existing member-only access unless the owner deliberately changes it. A signed-in staging fixture is not a public guest demo. Do not publish a generic WordPress demo link until its actual access policy/page is reviewed. A prior ZIP restores plugin files while retaining settings/meeting IDs; deactivation does not delete customer data.

## Update the presentation pages using Promptaur

Read the current Features page and Demo page through the connector, retain their versions, dry-run the narrow edit and preserve unrelated content. Add/replace the conference card under Features #streaming-features, keeping that anchor and adding #video-conference. State the verified four-person scope, camera optional, screen sharing/chat and host controls. Link the live PHP demo and optional setup/hosting. Add the new GitHub URL only after publication; do not promise Pro, recording, file sharing, shared playback or large meetings.

Add the PHP demo under Try Standalone Apps on the Demo page. Keep development-preview wording until physical-device/two-network acceptance is complete. Read back both edits, verify anchors/links and inspect the rendered layout. Marketing publication is a separate owner step; this document does not authorize it.

## Owner submission handoff

Use the exact reviewed 0.2.0 ZIP and SHA256 from release/SHA256SUMS and the current release-readiness report. The main wordpress/ handoff copy must be byte-identical. Confirm the live author queue and complete ownership/compliance attestations yourself at https://wordpress.org/plugins/developers/add/ . Preparing the ZIP is not a submission receipt. Include the screenshot assets from the companion assets/ directory after approval; keep them outside the plugin runtime ZIP.

Record physical-device/two-network coverage and locale review accurately. The automated suite covers synthetic multi-browser media, private invitation acceptance/denial, public presence, hand feedback, themes, narrow panel layout and WordPress authorization. Existing manual test evidence must not be relabeled as coverage of every device. Private invitation keys in URLs are scoped room capabilities, never service-account tokens.
