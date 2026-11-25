// Public source is assembled from reviewed inputs, independently of the release pin.
// This creates a local export only; it never commits, pushes or publishes anything.
import { cp, mkdir, rm, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordpressRuntime } from './runtime-files.mjs';
export async function streamingConnectSource(root) {
  const shared = path.resolve(root, '../../wordpress/tools/streaming-connect');
  try { await access(path.join(shared, 'bundle.py')); return shared; } catch { return path.join(root, 'scripts/streaming-connect'); }
}
export async function exportFreeSource(root, target, wordpress) {
  let checkout = false; try { await access(path.join(target, '.git')); checkout = true; } catch { /* Generated export. */ }
  if (checkout) throw new Error('Refusing to replace a Git checkout; choose a separate generated export');
  await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
  const copy = async (from, to) => { await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true, filter: file => {
    const name = path.basename(file);
    return !/^(?:\.git|\.vscode|\.env.*|node_modules|test-results|playwright-report|config\.json|login\.json|\.DS_Store)$/.test(name) && !/ \d+(?:\.[^/]*)?$|(?:~|\.bak|\.orig|\.rej|\.swp|\.map)$/.test(name);
  } }); };
  for (const file of ['src', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'eslint.config.js', 'vitest.config.js', 'playwright.config.js', 'LICENSE', 'README.md', '.gitignore', 'THIRD-PARTY-NOTICES.txt', 'docs/protocol.md', 'docs/publishing.md', 'docs/screenshots']) await copy(path.join(root, file), path.join(target, file));
  // Provider/CRM database integration fixtures remain private; public tests exercise the Free app/host contract.
  const tests = ['config.test.js', 'tickets.test.php', 'server.test.cjs', 'transport.test.js', 'demo-state.test.php', 'media.test.js', 'legacy-room.test.cjs', 'demo-http.test.cjs', 'live-smoke.mjs', 'app-defaults.test.js', 'dev-server.cjs',
    'wordpress/management-fixture.php', 'wordpress/frontend.php', 'wordpress/connect.php', 'wordpress/access-pages.php', 'wordpress/setup-notice.php', 'wordpress/upgrade-seed.php', 'wordpress/access.php', 'wordpress/rest-privacy.php', 'wordpress/clean-install.php', 'wordpress/app-settings.php', 'wordpress/security-review.php', 'wordpress/upgrade.php',
    'browser/conference.spec.js', 'browser/push-to-talk.spec.js', 'browser/app-settings.spec.js', 'browser/wordpress.spec.js', 'browser/management.spec.js', 'browser/devices.spec.js', 'browser/connect.spec.js', 'fixtures/conference.cjs', 'fixtures/fake-audio.mjs'];
  for (const file of tests) await copy(path.join(root, 'tests', file), path.join(target, 'tests', file));
  for (const file of ['runtime-files.mjs', 'export-source.mjs', 'package.mjs', 'review-wordpress.mjs', 'wordpress-notices.mjs', 'sync.mjs', 'labels.py', 'published-client.json']) await copy(path.join(root, 'scripts', file), path.join(target, 'scripts', file));
  const shared = await streamingConnectSource(root);
  for (const file of ['bundle.py', 'connection.php.in', 'connection.css', 'products.json']) await copy(path.join(shared, file), path.join(target, 'scripts/streaming-connect', file));
  for (const file of ['README.md', 'index.php', 'theme.js', 'setup.css', 'setup.js', 'includes/demo-state.php', 'includes/tickets.php', 'assets/conference.js', 'assets/conference.css']) await copy(path.join(root, 'editions/php', file), path.join(target, 'editions/php', file));
  await copy(path.join(root, 'editions/shared/tickets.php'), path.join(target, 'editions/shared/tickets.php'));
  for (const file of wordpressRuntime) await copy(path.join(wordpress, file), path.join(target, 'editions/wordpress', file));
  await writeFile(path.join(target, '.gitignore'), 'node_modules/\ndist/\ndist-wordpress/\nrelease/\ntest-results/\nplaywright-report/\n.env*\n.vscode/\n.DS_Store\npublic/config.json\npublic/login.json\neditions/php/assets/\neditions/php/storage/\n');
  await writeFile(path.join(target, 'scripts/streaming-connect/README.md'), '# Bundled Streaming Connect\n\nOptional, consent-based account setup. PHP and CSS are bundled into the WordPress edition. Regenerate only this plugin: `python3 scripts/streaming-connect/bundle.py videowhisper-video-conference --root editions/wordpress`; append `--check` to verify the bundle. The readable template and product adapter do not contain account credentials. Provider callback support is optional; manual configuration remains available.\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let wordpress = path.resolve(root, '../../wordpress/videowhisper-video-conference/trunk');
  try { await access(path.join(wordpress, 'videowhisper-video-conference.php')); } catch { wordpress = path.join(root, 'editions/wordpress'); }
  await exportFreeSource(root, path.join(root, 'release/WebRTC-Video-Conference'), wordpress);
  console.log('Prepared explicit Free source export; no publication performed');
}
