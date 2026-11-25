import { test, expect } from '@playwright/test';
const consent='I agree to connect to the configured signaling service and share media with participants when enabled.';
async function instrument(page){await page.addInitScript(()=>{
 window.pttPeers=[];window.pttCaptures=[];window.pttTouch=[];
 const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.pttPeers.push(this);}};
 const replace=RTCRtpSender.prototype.replaceTrack;RTCRtpSender.prototype.replaceTrack=async function(track){if(window.deferAudioReplace&&track?.kind==='audio')await new Promise(resolve=>{window.resumeAudioReplace=resolve;});return replace.call(this,track);};
 const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await capture(...args);window.pttCaptures.push(stream);return stream;};
 for(const event of['pointerdown','pointerup'])document.addEventListener(event,e=>{if(e.pointerType==='touch'&&e.target.closest('[aria-label="Hold to talk"]'))window.pttTouch.push({event,enabled:window.pttCaptures.at(-1)?.getAudioTracks()[0]?.enabled});});
});}
async function lobby(page,invite='/'){await page.goto(invite);const form=page.locator('form').filter({has:page.getByRole('button',{name:invite==='/'?'Create meeting':'Open meeting',exact:true})}).first();await form.getByRole('checkbox').check();await form.getByRole('button').click();}
async function join(page){await page.getByRole('checkbox',{name:consent,exact:true}).check();await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();}
async function state(page){return page.evaluate(async()=>{
 const r={inVideo:0,outVideo:0,inAudio:0,outAudio:0,energy:0,enabled:[],captureCount:window.pttCaptures.length,ended:window.pttCaptures.every(s=>s.getTracks().every(t=>t.readyState==='ended'))};
 for(const pc of window.pttPeers){if(pc.connectionState!=='connected')continue;for(const row of(await pc.getStats()).values()){
  if(row.type==='inbound-rtp'&&row.kind==='audio'){r.inAudio+=row.bytesReceived||0;r.energy+=row.totalAudioEnergy||0;}
  if(row.type==='outbound-rtp'&&row.kind==='audio')r.outAudio+=row.bytesSent||0;
  if(row.type==='inbound-rtp'&&row.kind==='video')r.inVideo+=row.framesDecoded||0;
  if(row.type==='outbound-rtp'&&row.kind==='video')r.outVideo+=row.framesEncoded||0;
 }for(const s of pc.getSenders())if(s.track?.kind==='audio')r.enabled.push(s.track.enabled);}
 r.tracks=window.pttCaptures.at(-1)?.getAudioTracks().filter(t=>t.readyState==='live').map(t=>t.enabled)||[];return r;
});}
async function waitUntil(check,label){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(label);}
async function muted(page){await waitUntil(async()=>{const s=await state(page);return s.tracks.length>0&&s.tracks.every(v=>!v)&&s.enabled.length>0&&s.enabled.every(v=>!v);},'Actual audio tracks/senders did not mute');}
async function talking(page){await waitUntil(async()=>{const s=await state(page);return s.tracks.some(Boolean)&&s.enabled.some(Boolean);},'Actual audio sender did not enable');}
async function focusTalk(page){await page.getByRole('button',{name:'Hold to talk',exact:true}).focus();}
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:8092/reset');});
test('push to talk gates real audio and fails muted on release, focus loss, host mute, replacement and reconnect',async({page,browser,request})=>{
 await instrument(page);await lobby(page);expect((await state(page)).captureCount).toBe(0);expect((await state(page)).inVideo).toBe(0);await join(page);
 await page.getByRole('button',{name:'Invite',exact:true}).click();const invite=await page.getByLabel('Invitation link',{exact:true}).inputValue();await page.getByRole('button',{name:'Close invitations',exact:true}).click();
 const context=await browser.newContext({permissions:['camera','microphone']});const guest=await context.newPage();await instrument(guest);await lobby(guest,invite);await guest.getByRole('checkbox',{name:'Push to talk: hold to speak',exact:true}).check();await join(guest);
 try{
  await waitUntil(async()=>{for(const p of[page,guest]){const s=await state(p);if(!(s.inVideo>2&&s.outVideo>2&&s.inAudio>0&&s.outAudio>0))return false;}return true;},'Two-way decoded media did not start');
  await muted(guest);expect((await state(page)).energy).toBeLessThan(1e-6);
  await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await waitUntil(async()=>(await state(page)).energy>1e-4,'Remote received no audible audio while held');await guest.keyboard.up('Space');await muted(guest);
  await guest.waitForTimeout(500);const before=(await state(page)).energy;await guest.waitForTimeout(700);expect((await state(page)).energy-before).toBeLessThan(1e-6);
  const hold=guest.getByRole('button',{name:'Hold to talk',exact:true}),box=await hold.boundingBox();await guest.mouse.move(box.x+box.width/2,box.y+box.height/2);await guest.mouse.down();await talking(guest);await guest.mouse.move(1,1);await guest.mouse.up();await muted(guest);
  await focusTalk(guest);await guest.keyboard.down('Enter');await talking(guest);await guest.getByRole('button',{name:'Chat',exact:true}).focus();await muted(guest);await guest.keyboard.up('Enter');
  if(!await guest.getByRole('textbox',{name:'Message',exact:true}).isVisible())await guest.getByRole('button',{name:'Chat',exact:true}).click();await guest.getByRole('textbox',{name:'Message',exact:true}).fill('Typing spaces keeps the mic muted');await muted(guest);
  await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await guest.evaluate(()=>window.dispatchEvent(new Event('blur')));await muted(guest);await guest.keyboard.down('Space');await muted(guest);await guest.keyboard.up('Space');
  await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await guest.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await muted(guest);await guest.keyboard.up('Space');await guest.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await muted(guest);
  await page.getByRole('button',{name:'People',exact:true}).click();await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await page.getByRole('button',{name:'Request mute',exact:true}).evaluate(button=>button.click());await muted(guest);await guest.keyboard.down('Space');await muted(guest);await guest.keyboard.up('Space');
  await guest.getByRole('button',{name:'Devices & connection',exact:true}).click();await guest.getByRole('button',{name:'Apply selected devices',exact:true}).click();await expect(guest.locator('.vwc-device-panel').getByRole('status')).toHaveText('Selected devices are now in use.');await muted(guest);
  await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await request.post('http://127.0.0.1:8092/drop');await waitUntil(async()=>!(await state(guest)).tracks.some(Boolean),'Disconnect did not close microphone');await guest.keyboard.up('Space');await expect(hold).toBeEnabled();await muted(guest);
  await guest.getByRole('button',{name:'Disable push to talk',exact:true}).click();await expect(guest.getByRole('button',{name:'Unmute microphone',exact:true})).toBeVisible();await muted(guest);await guest.getByRole('button',{name:'Unmute microphone',exact:true}).click();await talking(guest);
  await guest.evaluate(()=>{window.deferAudioReplace=true;});await guest.getByRole('button',{name:'Apply selected devices',exact:true}).click();await waitUntil(()=>guest.evaluate(()=>typeof window.resumeAudioReplace==='function'),'Audio replacement did not pause');
  await guest.getByRole('button',{name:'Enable push to talk',exact:true}).click();expect(await guest.evaluate(()=>window.pttCaptures.flatMap(s=>s.getAudioTracks()).filter(t=>t.readyState==='live').every(t=>!t.enabled))).toBe(true);await guest.evaluate(()=>{window.deferAudioReplace=false;window.resumeAudioReplace();});await expect(guest.locator('.vwc-device-panel').getByRole('status')).toHaveText('Selected devices are now in use.');await muted(guest);await focusTalk(guest);await guest.keyboard.down('Space');await talking(guest);await guest.getByRole('button',{name:'Leave',exact:true}).click();expect((await state(guest)).ended).toBe(true);await guest.keyboard.up('Space');
  await page.getByRole('button',{name:'Leave',exact:true}).click();
 }finally{await context.close();}
});
test('WordPress default is optional; mobile touch and no-media joining preserve consent and mute',async({page,browser})=>{
 test.skip(!process.env.VWC_WP_TEST_URL||!process.env.VWC_WP_FIXTURE_FILE,'Owned WordPress fixture required');
 const base=process.env.VWC_WP_TEST_URL,url=base+'/wp-admin/edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=app';
 await page.goto(base+'/wp-login.php');await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();await expect(page).toHaveURL(/\/wp-admin\//);await page.goto(url);
 const flag=page.getByRole('checkbox',{name:'Enable push to talk by default; participants can choose whether to use it.',exact:true}),old=await flag.isChecked();await flag.check();await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 const context=await browser.newContext({permissions:['camera','microphone'],hasTouch:true,isMobile:true,viewport:{width:320,height:844}});const guest=await context.newPage();await instrument(guest);
 try{
  const fs=await import('node:fs/promises'),routes=JSON.parse(await fs.readFile(process.env.VWC_WP_FIXTURE_FILE,'utf8'));await guest.goto(base+routes.public);const option=guest.getByRole('checkbox',{name:'Push to talk: hold to speak',exact:true});await expect(option).toBeChecked();await expect(guest.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();expect((await state(guest)).captureCount).toBe(0);
  await option.uncheck();await join(guest);expect((await state(guest)).tracks).toEqual([true]);await guest.getByRole('button',{name:'Leave',exact:true}).click();await option.check();await join(guest);const hold=guest.getByRole('button',{name:'Hold to talk',exact:true});await expect(hold).toBeEnabled();expect((await state(guest)).tracks).toEqual([false]);
  const box=await hold.boundingBox();await guest.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);expect(await guest.evaluate(()=>window.pttTouch)).toEqual([{event:'pointerdown',enabled:true},{event:'pointerup',enabled:false}]);expect((await state(guest)).tracks).toEqual([false]);expect(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await guest.getByRole('button',{name:'Leave',exact:true}).click();const captures=(await state(guest)).captureCount;await guest.getByRole('checkbox',{name:'Use camera and microphone',exact:true}).uncheck();await join(guest);await expect(hold).toBeDisabled();expect((await state(guest)).captureCount).toBe(captures);await guest.getByRole('button',{name:'Leave',exact:true}).click();expect((await state(guest)).ended).toBe(true);
 }finally{await context.close();await page.goto(url);await flag.setChecked(old);await page.getByRole('button',{name:'Save Changes',exact:true}).click();}
});
