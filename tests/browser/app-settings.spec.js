import { test, expect } from '@playwright/test';
const choices={participants:'2',layout:'speaker',panel:'people',theme:'dark',media:'economy',embed_height:'720px'};
const flags={join_media:false,mic_muted:true,camera_off:true,screen_share:false};
const consent='I agree to connect to the configured signaling service and share media with participants when enabled.';
async function instrument(page){await page.addInitScript(()=>{window.peers=[];window.captures=[];const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.peers.push(this);}};const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await capture(...args);window.captures.push(stream);return stream;};});}
async function state(page){return page.evaluate(async()=>{const r={inVideo:0,outVideo:0,inAudio:0,outAudio:0,senders:[]};for(const pc of window.peers){if(pc.connectionState!=='connected')continue;for(const row of(await pc.getStats()).values()){if(row.type==='inbound-rtp'&&row.kind==='video')r.inVideo+=row.framesDecoded||0;if(row.type==='outbound-rtp'&&row.kind==='video')r.outVideo+=row.framesEncoded||0;if(row.type==='inbound-rtp'&&row.kind==='audio')r.inAudio+=row.bytesReceived||0;if(row.type==='outbound-rtp'&&row.kind==='audio')r.outAudio+=row.bytesSent||0;}for(const s of pc.getSenders())if(s.track)r.senders.push({kind:s.track.kind,enabled:s.track.enabled,settings:s.track.getSettings(),encodings:s.getParameters().encodings});}return r;});}
const decoded=s=>s.inVideo>2&&s.outVideo>2&&s.inAudio>0&&s.outAudio>0;
async function waitMedia(page){for(let i=0;i<80;i++){const s=await state(page);if(decoded(s))return s;await page.waitForTimeout(250);}throw new Error('Economy two-way decoded RTP did not advance: '+JSON.stringify(await state(page)));}
async function join(page){await page.getByRole('checkbox',{name:consent,exact:true}).check();await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();}
test('native App settings survive save and control entry, presentation, signed capacity and actual media',async({page,browser})=>{
 test.skip(!process.env.VWC_WP_TEST_URL||!process.env.VWC_WP_MEETING,'Owned WordPress fixture required');
 const base=process.env.VWC_WP_TEST_URL,url=base+'/wp-admin/edit.php?post_type=vwconf_meeting&page=vwconf-settings&tab=app';
 await page.goto(base+'/wp-login.php');await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();await page.goto(url);
 const old={};for(const key of Object.keys(choices)){old[key]=await page.locator('#vwconf-app-'+key).inputValue();await page.locator('#vwconf-app-'+key).selectOption(choices[key]);}
 for(const[key,value]of Object.entries(flags)){const input=page.locator(`[name="vwconf_app_settings[${key}]"]`);old[key]=await input.isChecked();await input.setChecked(value);}
 const contexts=[];
 try{
  await page.getByRole('button',{name:'Save Changes',exact:true}).click();for(const[key,value]of Object.entries(choices))await expect(page.locator('#vwconf-app-'+key)).toHaveValue(value);
  for(const[key,value]of Object.entries(flags))expect(await page.locator(`[name="vwconf_app_settings[${key}]"]`).isChecked()).toBe(value);
  const host=await page.context().newPage();await instrument(host);await host.goto(`${base}/wp-admin/admin-post.php?action=vwconf_app&meeting=${process.env.VWC_WP_MEETING}`);
  const media=host.getByRole('checkbox',{name:'Use camera and microphone',exact:true});await expect(media).not.toBeChecked();await expect(host.getByRole('button',{name:'Join meeting',exact:true})).toBeDisabled();
  expect(await host.evaluate(()=>window.captures.length)).toBe(0);expect(decoded(await state(host))).toBe(false);expect(await host.locator('html').getAttribute('data-theme')).toBe('dark');
  await join(host);expect(await host.evaluate(()=>window.captures.length)).toBe(0);await host.getByRole('button',{name:'Leave',exact:true}).click();
  await media.check();await join(host);await expect(host.getByRole('button',{name:'Unmute microphone',exact:true})).toBeEnabled();await expect(host.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();await expect(host.getByRole('button',{name:'Share screen',exact:true})).toHaveCount(0);
  expect(await host.evaluate(()=>window.captures.at(-1).getTracks().every(t=>!t.enabled))).toBe(true);await expect(host.getByRole('button',{name:'Close people',exact:true})).toBeVisible();await expect(host.getByRole('button',{name:'Gallery',exact:true})).toBeVisible();
  await host.getByRole('button',{name:'Invite',exact:true}).click();const invite=await host.getByLabel('Invitation link',{exact:true}).inputValue();await host.getByRole('button',{name:'Close invitations'}).click();
  const ctx=await browser.newContext({permissions:['camera','microphone']});contexts.push(ctx);const guest=await ctx.newPage();await instrument(guest);await guest.goto(invite);await guest.getByLabel('Display name',{exact:true}).fill('Economy guest');await guest.getByRole('checkbox',{name:'Use camera and microphone',exact:true}).check();await join(guest);
  for(const p of[host,guest]){await p.getByRole('button',{name:'Unmute microphone',exact:true}).click();await p.getByRole('button',{name:'Start camera',exact:true}).click();}
  for(const p of[host,guest]){const r=await waitMedia(p),v=r.senders.find(s=>s.kind==='video');expect(v.settings.width).toBeLessThanOrEqual(320);expect(v.settings.height).toBeLessThanOrEqual(180);expect(v.settings.frameRate).toBeLessThanOrEqual(10);expect(v.encodings[0].maxBitrate).toBe(90000);expect(r.senders.find(s=>s.kind==='audio').encodings[0].maxBitrate).toBe(24000);}
  const thirdCtx=await browser.newContext();contexts.push(thirdCtx);const third=await thirdCtx.newPage();await third.goto(invite);await third.getByLabel('Display name',{exact:true}).fill('Third guest');await third.getByRole('checkbox',{name:consent,exact:true}).check();await third.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(third.getByText('This meeting is full.',{exact:true})).toBeVisible();
  for(const p of[guest,host])await p.getByRole('button',{name:'Leave',exact:true}).click();await host.close();
 }finally{
  for(const context of contexts)await context.close();await page.goto(url);for(const key of Object.keys(choices))await page.locator('#vwconf-app-'+key).selectOption(old[key]);for(const key of Object.keys(flags))await page.locator(`[name="vwconf_app_settings[${key}]"]`).setChecked(old[key]);await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 }
});
