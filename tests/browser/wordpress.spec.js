import { test, expect } from '@playwright/test';
async function instrumentPeers(page) {
 await page.addInitScript(()=>{window.__vwconfPeers=[];const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.__vwconfPeers.push(this);}};});
}
async function mediaState(page) {
 return page.evaluate(async()=>{
  const state={incomingVideo:0,outgoingVideo:0,incomingAudio:0,outgoingAudio:0,senders:[]};
  for(const pc of window.__vwconfPeers||[]) {
   if(pc.connectionState!=='connected')continue;
   for(const row of (await pc.getStats()).values()) {
    if(row.type==='inbound-rtp'&&row.kind==='video')state.incomingVideo+=row.framesDecoded||0;
    if(row.type==='outbound-rtp'&&row.kind==='video')state.outgoingVideo+=row.framesEncoded||0;
    if(row.type==='inbound-rtp'&&row.kind==='audio')state.incomingAudio+=row.bytesReceived||0;
    if(row.type==='outbound-rtp'&&row.kind==='audio')state.outgoingAudio+=row.bytesSent||0;
   }
   for(const sender of pc.getSenders())if(sender.track)state.senders.push({kind:sender.track.kind,settings:sender.track.getSettings(),encodings:sender.getParameters().encodings});
  }
  return state;
 });
}
const decodedMedia=state=>state.incomingVideo>2&&state.outgoingVideo>2&&state.incomingAudio>0&&state.outgoingAudio>0;
async function waitForDecodedMedia(page) {
 for(let attempt=0;attempt<80;attempt++){const state=await mediaState(page);if(decodedMedia(state))return state;await page.waitForTimeout(250);}
 throw new Error('Connected decoded audio/video RTP did not advance');
}
test('WordPress iframe uses guest and host callbacks with two-way media',async({page,browser})=>{
 test.skip(!process.env.VWC_WP_TEST_URL || !process.env.VWC_WP_MEETING,'Optional isolated wp-env integration');
 const wp=process.env.VWC_WP_TEST_URL,meeting=process.env.VWC_WP_MEETING;
 await instrumentPeers(page);
 const url=`${wp}/wp-admin/admin-post.php?action=vwc_app&meeting=${meeting}`;
 await page.goto(`${wp}/wp-login.php`);await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();
 const beforeJoinRequests=[];let socketsBeforeJoin=0;
 page.on('request', request=>beforeJoinRequests.push(request.url()));
 page.on('websocket', ()=>socketsBeforeJoin++);
 await page.goto(url);await page.getByLabel('Display name',{exact:true}).fill('Meeting owner');
 expect(beforeJoinRequests.every(request=>new URL(request).origin===new URL(wp).origin)).toBe(true);
 expect(socketsBeforeJoin).toBe(0);expect(decodedMedia(await mediaState(page))).toBe(false);
 await page.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Invite',exact:true}).click();const invite=await page.getByLabel('Invitation link',{exact:true}).inputValue();expect(invite).toContain('/conference/');await page.getByRole('button',{name:'Close invitations'}).click();
 const context=await browser.newContext({permissions:['camera','microphone']});const guest=await context.newPage();await instrumentPeers(guest);const response=await guest.goto(invite);
 expect(response.headers()['cache-control']).toContain('no-store');
 expect(await guest.content()).not.toContain('local-wordpress-test-token');
 await guest.getByLabel('Display name',{exact:true}).fill('Invited guest');await guest.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await guest.getByRole('button',{name:'Join meeting',exact:true}).click();
 await expect.poll(()=>guest.locator('video').evaluateAll(videos=>videos.filter(v=>v.srcObject?.getTracks().some(t=>t.readyState==='live')).length)).toBe(2);
 const hostMedia=await waitForDecodedMedia(page),guestMedia=await waitForDecodedMedia(guest);
 for(const state of [hostMedia,guestMedia]) {
  const video=state.senders.find(sender=>sender.kind==='video');expect(video).toBeTruthy();expect(video.settings.frameRate).toBeLessThanOrEqual(15);expect(video.settings.width).toBeLessThanOrEqual(640);expect(video.settings.height).toBeLessThanOrEqual(360);expect(video.encodings.length).toBeGreaterThan(0);expect(video.encodings[0].maxBitrate).toBe(180000);expect(state.senders.find(sender=>sender.kind==='audio').encodings[0].maxBitrate).toBe(32000);
 }
 await page.waitForTimeout(500);expect((await mediaState(page)).incomingVideo).toBeGreaterThan(hostMedia.incomingVideo);expect((await mediaState(guest)).incomingVideo).toBeGreaterThan(guestMedia.incomingVideo);
 if(process.env.VWC_RTP_EVIDENCE){const fs=await import('node:fs/promises');await fs.writeFile(process.env.VWC_RTP_EVIDENCE,JSON.stringify({host:hostMedia,guest:guestMedia},null,2));}
 await page.getByRole('button',{name:'People',exact:true}).click();await expect(page.getByRole('button',{name:'Remove',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Request mute',exact:true}).click();await expect(guest.getByRole('button',{name:'Unmute microphone',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Remove',exact:true}).click();await expect(guest.getByText('You were removed from this meeting.',{exact:true})).toBeVisible();
 await context.close();await page.getByRole('button',{name:'Leave',exact:true}).click();
});

test('WordPress frontend explains member/private access and excludes generic discovery',async({request})=>{
 test.skip(!process.env.VWC_WP_TEST_URL || !process.env.VWC_WP_FIXTURE_FILE,'Optional isolated frontend fixtures');
 const fs=await import('node:fs/promises'),routes=JSON.parse(await fs.readFile(process.env.VWC_WP_FIXTURE_FILE,'utf8')),base=process.env.VWC_WP_TEST_URL;
 for(const [name,status,text] of [['members',401,'Sign in to join'],['private',403,'requires its access key'],['privateWrong',403,'requires its access key'],['privateValid',200,'window.videowhisperConfig'],['public',200,'window.videowhisperConfig']]) {
  const r=await request.get(base+routes[name]);expect(r.status(),name).toBe(status);expect(r.headers()['cache-control']).toContain('no-store');expect(await r.text()).toContain(text);
 }
 const list=await request.get(base+'/?post_type=vwconf_meeting');expect(await list.text()).not.toContain('Private content canary');
 const embed=await request.get(base+'/?rest_route=/oembed/1.0/embed&url='+encodeURIComponent(base+routes.private));expect(embed.status()).toBe(404);
});
