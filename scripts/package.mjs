import { cp, mkdir, rm, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
// A PHP-only maintenance release retains the independently reviewed WordPress edition.
const standaloneOnly=process.argv.includes('--standalone-only');
const sibling=path.resolve(root,'../../wordpress/videowhisper-video-conference/trunk');
let wp=path.join(root,'editions/wordpress');
try{await access(path.join(sibling,'videowhisper-video-conference.php'));wp=sibling;}catch{}
await access(path.join(wp,'videowhisper-video-conference.php'));
const release=path.join(root,'release');
const copy=async(a,b)=>{await mkdir(path.dirname(b),{recursive:true});await cp(a,b,{recursive:true,filter:source=>!/(?:~|\.bak|\.orig|\.rej|\.swp)$/.test(source) && path.basename(source)!=='.DS_Store'});};
// Only explicit public inputs enter packages. Never traverse sibling server config or public/*.json.
const sourceFiles=['src','index.html','package.json','package-lock.json','vite.config.js','eslint.config.js','vitest.config.js','playwright.config.js','LICENSE'];
// The installable edition is a runtime/source allowlist, never a whole development folder copy.
async function copyWordPress(target) {
 for(const file of ['videowhisper-video-conference.php','readme.txt','LICENSE','THIRD-PARTY-NOTICES.txt','SOURCE.txt','includes/tickets.php','includes/labels.php','includes/meetings.php','assets/conference.js','assets/conference.css','source']) await copy(path.join(wp,file),path.join(target,file));
 for(const file of await readdir(path.join(wp,'languages'))) if (/^[a-zA-Z0-9_.-]+\.(?:pot|po|mo|json|txt)$/.test(file)) await copy(path.join(wp,'languages',file),path.join(target,'languages',file));
}

if(!standaloneOnly)await copy(path.join(root,'editions/shared/tickets.php'),path.join(wp,'includes/tickets.php'));
await copy(path.join(root,'editions/shared/tickets.php'),path.join(root,'editions/php/includes/tickets.php'));
for(const [target,source] of [...standaloneOnly?[]:[[path.join(wp,'assets'),'dist-wordpress/assets']],[path.join(root,'editions/php/assets'),'dist/assets']]){await rm(target,{recursive:true,force:true});await copy(path.join(root,source),target);}
if(!standaloneOnly){
await rm(path.join(wp,'source'),{recursive:true,force:true});
for(const file of sourceFiles)await copy(path.join(root,file),path.join(wp,'source',file));
const sourcePackage=JSON.parse(await readFile(path.join(wp,'source/package.json')));sourcePackage.scripts={build:'vite build --mode wordpress'};
await writeFile(path.join(wp,'source/package.json'),JSON.stringify(sourcePackage,null,2)+'\n');
}
await copy(path.join(root,'src/services/theme.js'),path.join(root,'editions/php/theme.js'));
await mkdir(release,{recursive:true});
const repo=path.join(release,'WebRTC-Video-Conference');await rm(repo,{recursive:true,force:true});await mkdir(repo,{recursive:true});
for(const file of [...sourceFiles,'README.md','.gitignore','THIRD-PARTY-NOTICES.txt','scripts','tests','editions','docs/protocol.md','docs/publishing.md','docs/screenshots'])await copy(path.join(root,file),path.join(repo,file));
for(const internal of ['docs/publishing-review','docs/staging']) await rm(path.join(repo,internal),{recursive:true,force:true});
if(!standaloneOnly){
for(const file of ['LICENSE','THIRD-PARTY-NOTICES.txt'])await copy(path.join(root,file),path.join(wp,file));
await rm(path.join(wp,'SOURCE.md'),{force:true});
await writeFile(path.join(wp,'SOURCE.txt'),'# Client source\n\nSource and lockfile are in source/. With Node.js 22+: `cd source && npm ci && npm run build`. Copy dist-wordpress/assets/* to ../assets/. This build uses the WordPress wp-element script dependency instead of bundling another React renderer. The standalone PHP edition uses the same source with its self-contained build. No remote executable assets are loaded. PHP ticket source: includes/tickets.php. Canonical client source and build instructions: https://github.com/videowhisper/WebRTC-Video-Conference .\n');
}
await rm(path.join(repo,'editions/wordpress'),{recursive:true,force:true});await copyWordPress(path.join(repo,'editions/wordpress'));
const version=JSON.parse(await readFile(path.join(root,'package.json'))).version;
const wordpressVersion=(await readFile(path.join(wp,'videowhisper-video-conference.php'),'utf8')).match(/^\s*\*\s*Version:\s*(\S+)/m)?.[1];
if(!wordpressVersion)throw new Error('Missing WordPress version');
const archives=[...standaloneOnly?[]:[[`videowhisper-video-conference-${wordpressVersion}.zip`,wp,'videowhisper-video-conference']],[`WebRTC-Video-Conference-${version}.zip`,repo,'WebRTC-Video-Conference']];
const hashes={};
for(const [filename,source,folder] of archives){
 const stage=path.join(release,'stage');await rm(stage,{recursive:true,force:true});if(folder==='videowhisper-video-conference')await copyWordPress(path.join(stage,folder));else await copy(source,path.join(stage,folder));
 const zip=path.join(release,filename);await rm(zip,{force:true});execFileSync('python3', ['-c', `import sys, pathlib, zipfile
stage,folder,dest=sys.argv[1:]
with zipfile.ZipFile(dest,'w') as archive:
 for file in sorted(pathlib.Path(stage,folder).rglob('*')):
  if not file.is_file(): continue
  info=zipfile.ZipInfo(file.relative_to(stage).as_posix(),date_time=(2026,11,4,0,0,0))
  info.create_system=3
  info.external_attr=0o100644<<16
  archive.writestr(info,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
`, stage, folder, zip]);
 const listing=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'});
 if(/(?:^|\/)(?:\.env[^/]*|\.vscode|node_modules|config\.json|login\.json|test-results|\.DS_Store)(?:\/|$)|(?:\.map|~|\.bak|\.orig|\.rej|\.swp)$/m.test(listing))throw new Error('Forbidden package file');
 hashes[filename]=createHash('sha256').update(await readFile(zip)).digest('hex');await rm(stage,{recursive:true,force:true});
}
await writeFile(path.join(release,'SHA256SUMS'),Object.entries(hashes).map(([file,hash])=>`${hash}  ${file}`).join('\n')+'\n');
console.log(JSON.stringify(hashes,null,2));
