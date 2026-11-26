import { build } from 'vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

export async function buildWordPressSetup(root) {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    publicDir: false,
    build: {
      lib: { entry: path.join(root, 'admin/setup.js'), name: 'VideoWhisperConferenceSetup', formats: ['iife'], fileName: () => 'setup.js' },
      write: false,
      minify: 'esbuild',
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  });
  return result[0].output.find(asset => asset.type === 'chunk' && asset.fileName === 'setup.js').code;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sibling = path.resolve(root, '../../wordpress/videowhisper-video-conference/trunk/assets/setup.js');
  await writeFile(process.argv[2] ?? sibling, await buildWordPressSetup(root));
}
