import { cp, mkdir, rm, readFile, writeFile, readdir, access, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { wordpressRuntime } from './runtime-files.mjs';
import { exportFreeSource, streamingConnectSource } from './export-source.mjs';
import { writeWordPressNotices } from './wordpress-notices.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// A PHP-only maintenance release retains the independently reviewed WordPress edition.
const standaloneOnly=process.argv.includes('--standalone-only');
const wordpressOnly=process.argv.includes('--wordpress-only');
if(standaloneOnly && wordpressOnly)throw new Error('Select only one edition');
const sibling=path.resolve(root,'../../wordpress/videowhisper-video-conference/trunk');
let wp=path.join(root,'editions/wordpress');
try{await access(path.join(sibling,'videowhisper-video-conference.php'));wp=sibling;}catch{}
await access(path.join(wp,'videowhisper-video-conference.php'));
const release=path.join(root,'release');
const copy=async(a,b)=>{await mkdir(path.dirname(b),{recursive:true});await cp(a,b,{recursive:true,filter:source=>!/(?:~|\.bak|\.orig|\.rej|\.swp)$/.test(source) && path.basename(source)!=='.DS_Store'});};
// Only explicit public inputs enter packages. Never traverse sibling server config or public/*.json.
// Shared runtime allowlist is also used by the public source export.
async function copyWordPress(target) {
 for(const file of wordpressRuntime)await copy(path.join(wp,file),path.join(target,file));
}

if(!standaloneOnly)await copy(path.join(root,'editions/shared/tickets.php'),path.join(wp,'includes/tickets.php'));
if(!wordpressOnly)await copy(path.join(root,'editions/shared/tickets.php'),path.join(root,'editions/php/includes/tickets.php'));
const targets=[];
if(!standaloneOnly)targets.push([path.join(wp,'assets'),'dist-wordpress/assets']);
if(!wordpressOnly)targets.push([path.join(root,'editions/php/assets'),'dist/assets']);
for(const [target,source] of targets){await rm(target,{recursive:true,force:true});await copy(path.join(root,source),target);}
if(!wordpressOnly)await copy(path.join(root,'src/services/theme.js'),path.join(root,'editions/php/theme.js'));
await mkdir(release,{recursive:true});
if(!standaloneOnly){
await copy(path.join(root,'LICENSE'),path.join(wp,'LICENSE'));
for(const file of ['SOURCE.md','SOURCE.txt'])await rm(path.join(wp,file),{force:true});
 if((await readFile(path.join(wp,'videowhisper-video-conference.php'),'utf8')).includes('/includes/connect.php'))execFileSync('python3',[path.join(await streamingConnectSource(root),'bundle.py'),'videowhisper-video-conference','--root',wp,'--check'],{stdio:'inherit'});
 const dependencies=await writeWordPressNotices(root,wp);
 console.log('WordPress bundled dependency notices:',dependencies.join(', '));
}
const repo=path.join(release,'WebRTC-Video-Conference');
if(!wordpressOnly)await exportFreeSource(root,repo,wp);
const version=JSON.parse(await readFile(path.join(root,'package.json'))).version;
const wordpressVersion=(await readFile(path.join(wp,'videowhisper-video-conference.php'),'utf8')).match(/^\s*\*\s*Version:\s*(\S+)/m)?.[1];
if(!wordpressVersion)throw new Error('Missing WordPress version');
const archives=[];
if(!standaloneOnly)archives.push([`videowhisper-video-conference-${wordpressVersion}.zip`,wp,'videowhisper-video-conference']);
if(!wordpressOnly)archives.push([`WebRTC-Video-Conference-${version}.zip`,repo,'WebRTC-Video-Conference']);
const hashes={};
for(const [filename,source,folder] of archives){
 const stage=path.join(release,'stage');await rm(stage,{recursive:true,force:true});if(folder==='videowhisper-video-conference')await copyWordPress(path.join(stage,folder));else await copy(source,path.join(stage,folder));
 const zip=path.join(release,filename),candidate=zip+'.tmp';await rm(candidate,{force:true});execFileSync('python3', ['-c', `import sys, pathlib, zipfile
stage,folder,dest=sys.argv[1:]
with zipfile.ZipFile(dest,'w') as archive:
 for file in sorted(pathlib.Path(stage,folder).rglob('*')):
  if not file.is_file(): continue
  info=zipfile.ZipInfo(file.relative_to(stage).as_posix(),date_time=(2026,11,4,0,0,0))
  info.create_system=3
  info.external_attr=0o100644<<16
  archive.writestr(info,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
`, stage, folder, candidate]);
 const listing=execFileSync('unzip',['-Z1',candidate],{encoding:'utf8'});
 if(/(?:^|\/)(?:\.env[^/]*|\.vscode|node_modules|config\.json|login\.json|test-results|\.DS_Store)(?:\/|$)|(?:\.map|~|\.bak|\.orig|\.rej|\.swp)$/m.test(listing))throw new Error('Forbidden package file');
 if(folder==='videowhisper-video-conference' && /(?:^|\/)(?:source|tests|node_modules|languages|development)(?:\/|$)|(?:eslint|vitest|playwright)\.config| [0-9]+\./m.test(listing))throw new Error('Development or duplicate file in WordPress package');
 if(folder==='videowhisper-video-conference')execFileSync(process.execPath,[path.join(root,'scripts/review-wordpress.mjs'),candidate],{stdio:'inherit'});
 hashes[filename]=createHash('sha256').update(await readFile(candidate)).digest('hex');
 let previous=null;try{previous=createHash('sha256').update(await readFile(zip)).digest('hex');}catch{}
 if(previous && previous!==hashes[filename]){await rm(candidate,{force:true});throw new Error('Existing release differs; increment the edition version instead of overwriting '+filename);}
 if(previous)await rm(candidate);else await rename(candidate,zip);
 await rm(stage,{recursive:true,force:true});
}
await writeFile(path.join(release,'SHA256SUMS'),Object.entries(hashes).map(([file,hash])=>`${hash}  ${file}`).join('\n')+'\n');
console.log(JSON.stringify(hashes,null,2));
