# Building and publishing the Free conference editions

Owner: VideoWhisper. Audience: PHP developers and WordPress site administrators. This is a four-person WebRTC mesh application. A compatible signaling account and STUN/TURN configuration are required; no server deployment is implied by publishing client source.

## Verify the candidate

With Node.js22+, Python3 and PHP8.2+, run `npm ci`, `npm run lint`, `npm test`, `npm run test:php`, `npm run test:server` and `npm run build`. Run `npm run test:e2e` with Chromium/Chrome and fake test media. Native WordPress cases need a disposable WordPress fixture; check both minimum supported and current WordPress/PHP. Never run fixture-seeding, downgrade or destructive database tests against a customer site.

Check native settings, role/room access, private invitations, frontend management and preservation of existing room IDs, keys and account configuration. Before joining, verify no capture or signaling and unchecked consent. For media, check decoded RTP and sender bitrate parameters in both directions, not merely visible video elements or received packet counts. Verify push-to-talk release/cancel/focus/visibility/reconnect/host-mute/device-change behavior with actual disabled tracks, and ensure it never activates while typing chat. Check mobile touch and keyboard access. Hardware/browser/network testing remains necessary in addition to synthetic media tests.

Run a dependency audit, Plugin Check (including i18n and explicit runtime checks) and the [official readme validator](https://wordpress.org/plugins/developers/readme-validator/). Inspect check output as well as exit status. Review GPL-compatible licenses, service/privacy disclosures and consent. This plugin’s directory-review policy excludes translation catalogs/templates from the installable runtime; use translate.wordpress.org and standard language packs.

## Publish source before the WordPress runtime

`node scripts/export-source.mjs` creates a local, explicit Free source export under `release/WebRTC-Video-Conference/`. It does not publish anything. Review its complete inventory, diff and secrets scan before committing to the public GitHub repository. It contains source, tests, build tools, licenses, public documentation and the two editions. It excludes credentials, local configuration, private development evidence, dependency trees, duplicate files and production data. Do not copy a whole private workspace into Git.

Commit/push the reviewed source, then record its immutable Git commit URL and SHA256 hashes of `dist-wordpress/assets/conference.js` and `conference.css` in `scripts/published-client.json` and the WordPress readme. Verify a clean checkout reproduces the meeting CSS and JS with `npm ci && npm run build`. For the First call tab in WordPress 0.7.1 and later, run `node scripts/wordpress-setup-build.mjs dist-wordpress/assets/setup.js` after that build. Record the setup bundle hash with the other assets in the WordPress readme and the packaging pin. A subsequent metadata commit may update the pin without changing client source or assets. Keep the referenced commit available.

`npm run package` produces the public source/PHP ZIP and the WordPress runtime ZIP. `--wordpress-only` or `--standalone-only` can select one edition. WordPress packaging enforces the source pin, exact emitted assets and required licenses. It installs only the explicit runtime allowlist; public source/build tools belong in GitHub, not in the installed plugin. Do not bypass the pin to ship changed minified assets. Existing versioned artifacts are not overwritten with different content: increment the version instead.

Before release, retain the prior version, matching runtime/source hashes and build instructions. Tag the reviewed Git commit without repointing existing tags. GitHub source publication and WordPress release both require owner authorization.

## WordPress.org release

After testing the exact final ZIP through clean install and upgrade, copy only its runtime into SVN `trunk/`, review the diff and add an immutable numeric `tags/<version>` matching the plugin header and readme Stable tag. Preserve existing tags and listing artwork. Commit the completed release once; SVN is a release repository, not a development log. Follow the [WordPress Subversion instructions](https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/) and [directory guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/).

Read back the SVN tag and compare all runtime hashes. Wait for WordPress.org’s versioned/latest ZIP and plugin-information API; verify the version and every installed-file hash. Record the SVN revision, archives and hashes. Upgrade an owned test site, verify the installed version and smoke-test settings, access, invitation and media behavior. A prior ZIP restores runtime while retaining conference data/settings; deactivation does not delete rooms.

## PHP deployment

Back up the targeted application runtime and keep private configuration/storage in place. Deploy only its edition runtime to an HTTPS host. Keep `VWC_ACCOUNT_TOKEN`, `VWC_SIGNING_KEY` and `VWC_STORAGE_DIR` private and use a dedicated account callback. Preserve active room state and historical data; do not reset storage to clear quotas. Verify abuse limits, idle cleanup, invitations and two-browser media. Use temporary synthetic participants, leave cleanly, and avoid logging credentials or private invitations.

A release is complete after readback and a deployed smoke test, with a named support owner and a rollback package. [Support](https://consult.videowhisper.com/) · [Managed WebRTC hosting](https://webrtchost.com/) · [Turnkey sites](https://site2stream.com/live/).
