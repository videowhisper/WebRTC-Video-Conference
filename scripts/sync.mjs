import { cp, mkdir, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const sibling=path.resolve(root,'../../wordpress/videowhisper-video-conference/trunk');
let wordpress=path.join(root,'editions/wordpress');
try{await access(path.join(sibling,'videowhisper-video-conference.php'));wordpress=sibling;}catch{}
const targets=[[path.join(root,'editions/php'),'dist/assets'],[wordpress,'dist-wordpress/assets']];
for(const [target,assets] of targets){
 try{await access(target);}catch{continue;}
 await mkdir(path.join(target,'includes'),{recursive:true});
 await cp(path.join(root,'editions/shared/tickets.php'),path.join(target,'includes/tickets.php'));
 await rm(path.join(target,'assets'),{recursive:true,force:true});
 await cp(path.join(root,assets),path.join(target,'assets'),{recursive:true});
}

await cp(path.join(root,'src/services/theme.js'),path.join(root,'editions/php/theme.js'));
execFileSync('python3',[path.join(root,'scripts/labels.py'),wordpress],{stdio:'inherit'});
