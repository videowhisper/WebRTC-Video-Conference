// Static review of the exact installable artifact; development tooling stays outside it.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const zip = process.argv[2];
assert(zip, 'Usage: node scripts/review-wordpress.mjs <candidate.zip>');
const prefix = 'videowhisper-video-conference/';
const files = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
const runtime = ['LICENSE', 'THIRD-PARTY-NOTICES.txt', 'assets/conference.css', 'assets/conference.js', 'includes/labels.php', 'includes/meetings.php', 'includes/tickets.php', 'includes/upgrade.php', 'readme.txt', 'videowhisper-video-conference.php'];
const main = execFileSync('unzip', ['-p', zip, prefix + 'videowhisper-video-conference.php'], { encoding: 'utf8' });
if(main.includes('/includes/connect.php'))runtime.push('includes/connect.php','includes/class-streaming-connect.php','includes/class-streaming-connect.css');
if(main.includes('/includes/app-settings.php'))runtime.push('includes/app-settings.php');
if(main.includes('/includes/management.php'))runtime.push('includes/access.php','includes/admin.php','includes/management.php','management.css');
const allowed=runtime.map(file=>prefix+file).sort();
assert.deepEqual(files.sort(), allowed, 'Only reviewed runtime/license/readme files may be installed');
for (const file of files.filter(file => file.endsWith('.php'))) {
  const php = execFileSync('unzip', ['-p', zip, file], { encoding: 'utf8' });
  assert(!/\b(?:function|class)\s+(?:vwc_|VWC_)/.test(php), 'Old PHP declaration prefix in ' + file);
  assert(!/define\(['"]VWC_/.test(php), 'Old constant prefix in ' + file);
  assert(!/\b(?:eval|base64_decode)\s*\(/.test(php) || file.endsWith('/tickets.php'), 'Unexpected dynamic/encoded execution in ' + file);
}
const readme = execFileSync('unzip', ['-p', zip, prefix + 'readme.txt'], { encoding: 'utf8' });
for (const text of ['== External services ==', 'stun:stun.l.google.com:19302', 'https://policies.google.com/terms', 'https://policies.google.com/privacy', 'Terms+of+Use', 'Privacy+Policy']) assert(readme.includes(text), 'Missing disclosure: ' + text);
const source = JSON.parse(execFileSync('cat', [fileURLToPath(new URL('./published-client.json', import.meta.url))], { encoding: 'utf8' }));
assert(readme.includes(source.url), 'Missing exact public client source');
console.log('WordPress review artifact: '+files.length+'-file allowlist, declarations and service/source disclosures passed');
