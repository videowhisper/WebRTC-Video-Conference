import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.VWC_LIVE_URL;
if(!base || !base.startsWith('https://')) throw new Error('Set VWC_LIVE_URL to an explicitly approved HTTPS PHP staging demo. This test creates two temporary rooms and up to four synthetic participants.');
const output=process.env.VWC_EVIDENCE_DIR || new URL('../test-results/live/',import.meta.url).pathname;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.VWC_CHROMIUM_PATH,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const contexts=[],results={},errors=[];
async function context(relay=false){const c=await browser.newContext({permissions:['camera','microphone']});contexts.push(c);await c.addInitScript(({relay})=>{const Native=window.RTCPeerConnection;window.testPeers=[];window.RTCPeerConnection=class extends Native{constructor(options){super({...options,...(relay?{iceTransportPolicy:'relay'}:{})});window.testPeers.push(this);}};},{relay});return c;}
async function open(c,invite='',name='Demo host',media=true){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.name));await p.goto(invite ? new URL(invite,base).href : base);const form=p.locator('form').filter({has:p.getByRole('button',{name:invite?'Open meeting':'Create meeting',exact:true})}).first();await form.locator('input[name="consent"]').check();await form.getByRole('button').click();await p.getByLabel('Display name',{exact:true}).fill(name);if(!media)await p.getByLabel('Use camera and microphone').uncheck();await p.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.',exact:true}).check();await p.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(p.getByRole('button',{name:'Leave',exact:true})).toBeVisible({timeout:20000});return p;}
async function invitation(p){await p.getByRole('button',{name:'Invite',exact:true}).click();const url=await p.getByLabel('Invitation link',{exact:true}).inputValue();await p.getByRole('button',{name:'Close invitations'}).click();await p.getByRole('button',{name:'Chat',exact:true}).click();return url;}
const decoded=p=>p.locator('video').evaluateAll(v=>v.filter(e=>e.readyState>=2&&e.videoWidth>0&&e.getVideoPlaybackQuality().totalVideoFrames>0).length);
async function relayTypes(p){return p.evaluate(async()=>{const types=[];for(const pc of window.testPeers){if(pc.connectionState!=='connected')continue;const report=await pc.getStats();for(const row of report.values())if(row.type==='transport'&&row.selectedCandidatePairId){const pair=report.get(row.selectedCandidatePairId),candidate=report.get(pair?.localCandidateId);if(candidate)types.push(candidate.candidateType);}}return [...new Set(types)];});}
try{
 const host=await open(await context());const invite=await invitation(host);const pages=[host];
 for(let i=1;i<4;i++){pages.push(await open(await context(),invite,'Demo guest '+i));for(const p of pages)await expect.poll(()=>decoded(p),{timeout:30000}).toBe(pages.length);results[pages.length+'participantsDecoded']=true;}
 await host.screenshot({path:output+'/live-php-four-participants.jpg',type:'jpeg',quality:85});
 for(const p of pages.slice(2))await p.getByRole('button',{name:'Leave',exact:true}).click();
 await expect.poll(()=>decoded(host)).toBe(2);
 await host.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{window.testScreen=await navigator.mediaDevices.getUserMedia({video:true,audio:false});return window.testScreen;};});
 await host.getByRole('button',{name:'Share screen',exact:true}).click();await expect.poll(()=>decoded(pages[1]),{timeout:20000}).toBe(3);
 await host.evaluate(()=>window.testScreen.getVideoTracks()[0].dispatchEvent(new Event('ended')));await expect.poll(()=>decoded(pages[1])).toBe(2);results.screenStartEnd=true;
 await host.getByRole('textbox',{name:'Message',exact:true}).fill('<em>conference demo verification</em>');await host.getByRole('button',{name:'Send message',exact:true}).click();await expect(pages[1].getByText('<em>conference demo verification</em>',{exact:true})).toBeVisible();expect(await pages[1].locator('em').count()).toBe(0);results.chatTextSafe=true;
 await host.getByRole('button',{name:'People',exact:true}).click();await host.getByRole('button',{name:'Request mute',exact:true}).click();await expect(pages[1].getByRole('button',{name:'Unmute microphone',exact:true})).toBeVisible();
 await host.getByRole('button',{name:'Spotlight',exact:true}).click();await host.getByRole('button',{name:'Lock meeting',exact:true}).click();await expect(host.getByRole('button',{name:'Unlock meeting',exact:true})).toBeVisible();await host.getByRole('button',{name:'Unlock meeting',exact:true}).click();
 await host.getByRole('button',{name:'Remove',exact:true}).click();await expect(pages[1].getByText('You were removed from this meeting.',{exact:true})).toBeVisible();results.hostModeration=true;
 await host.getByRole('button',{name:'Leave',exact:true}).click();await expect(host.getByRole('button',{name:'Join meeting',exact:true})).toBeVisible();
 await host.getByLabel('Use camera and microphone').uncheck();await host.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.',exact:true}).check();await host.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(host.getByRole('button',{name:'Leave',exact:true})).toBeVisible();await expect(host.getByRole('button',{name:'Unmute microphone',exact:true})).toBeDisabled();results.leaveRejoinNoMedia=true;await host.getByRole('button',{name:'Leave',exact:true}).click();
 for(const c of contexts)await c.close();contexts.length=0;
 const a=await open(await context(true),'','TURN host'),relayInvite=await invitation(a);const b=await open(await context(true),relayInvite,'TURN guest');
 for(const p of[a,b])await expect.poll(()=>decoded(p),{timeout:45000}).toBe(2);
 const types=[...(await relayTypes(a)),...(await relayTypes(b))];expect(types.length).toBeGreaterThan(0);expect(types.every(t=>t==='relay')).toBe(true);results.turnOnlyDecoded=true;results.selectedCandidateTypes=[...new Set(types)];
 await a.screenshot({path:output+'/live-php-turn-relay.jpg',type:'jpeg',quality:85});
 for(const p of[a,b])await p.getByRole('button',{name:'Leave',exact:true}).click();expect(errors).toEqual([]);
 results.pageErrors=errors;results.completedAt=new Date().toISOString();await fs.writeFile(output+'/live-media-verification.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
