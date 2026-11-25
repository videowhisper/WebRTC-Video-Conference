import { build } from 'vite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Identify code actually emitted into the WordPress browser bundle, rather than
// installing or crediting the entire development/test dependency tree.
export async function inventoryWordPress(root) {
  const packages = new Set(['tailwindcss']);
  const result = await build({
    root, configFile: path.join(root, 'vite.config.js'), mode: 'wordpress', logLevel: 'silent', build: { write: false },
    plugins: [{ name: 'vwc-runtime-license-inventory', generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (!module.renderedLength) continue;
          const suffix = id.split('/node_modules/').at(-1);
          if (suffix !== id) packages.add(suffix.startsWith('@') ? suffix.split('/').slice(0, 2).join('/') : suffix.split('/')[0]);
          else if (id === '\0vite/modulepreload-polyfill.js') packages.add('vite');
        }
      }
    } }],
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  return { output, packages: [...packages].sort() };
}

// Production packaging always enforces the published, reproducible client pin.
export async function writeWordPressNotices(root, wordpress) {
  const { output, packages } = await inventoryWordPress(root);
  const source = JSON.parse(await readFile(path.join(root, 'scripts/published-client.json'), 'utf8'));
  const readme = await readFile(path.join(wordpress, 'readme.txt'), 'utf8');
  if (!readme.includes(source.url)) throw new Error('WordPress readme must link the exact public client source');
  for (const [name, expected] of Object.entries(source.assets)) {
    const emitted = output.find(item => item.fileName === 'assets/' + name);
    if (!emitted) throw new Error('Missing WordPress asset: ' + name);
    const built = Buffer.from(emitted.type === 'chunk' ? emitted.code : emitted.source);
    const actual = await readFile(path.join(wordpress, 'assets', name));
    if (!built.equals(actual) || createHash('sha256').update(actual).digest('hex') !== expected || !readme.includes(expected)) {
      throw new Error('Publish and document matching public client source before packaging changed assets: ' + name);
    }
  }
  return writeRuntimeNotices(root, wordpress, packages);
}

// License inventory is also used by private review builds with a separate source archive.
export async function writeRuntimeNotices(root, wordpress, packages) {
  let notices = 'VideoWhisper Video Conference\nProject PHP/JavaScript source: GPL-2.0-or-later; see LICENSE.\n\n';
  notices += 'This inventory covers third-party code present in the bundled browser assets.\nWordPress supplies React through wp-element; React is not included in this bundle.\nBuild/test tools are not installed with this plugin. Exact source/build instructions are in readme.txt.\n';
  for (const name of [...packages].sort()) {
    const directory = path.join(root, 'node_modules', name);
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const filename = (await readdir(directory)).sort().find(file => /^(?:licen[cs]e|copying)(?:\.[a-z]+)?$/i.test(file));
    if (!filename) throw new Error('Missing bundled dependency license: ' + name);
    let license = await readFile(path.join(directory, filename), 'utf8');
    // Only Vite's core module-preload helper is emitted, not Vite's build-tool dependencies.
    if (name === 'vite') license = license.split('\n# Licenses of bundled dependencies')[0];
    notices += `\n\n===== ${name} ${pkg.version} (${pkg.license || 'see license'}) =====\n${license.trim()}\n`;
  }
  await writeFile(path.join(wordpress, 'THIRD-PARTY-NOTICES.txt'), notices);
  return [...packages].sort();
}
