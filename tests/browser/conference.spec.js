import { test, expect } from '@playwright/test';
async function open(page,invite='/',name='Host',media=true) {
 await page.goto(invite);const form=page.locator('form').filter({has:page.getByRole('button',{name:invite==='/'?'Create meeting':'Open meeting',exact:true})}).first();await form.getByRole('checkbox').check();await form.getByRole('button').click();
 await page.getByLabel('Display name',{exact:true}).fill(name);
 if(!media) await page.getByLabel('Use camera and microphone').uncheck();
 await page.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
}
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:8092/reset');});
async function invitation(page) { const hadChat=await page.getByRole('textbox',{name:'Message',exact:true}).isVisible();await page.getByRole('button',{name:'Invite',exact:true}).click(); const url=await page.getByLabel('Invitation link',{exact:true}).inputValue(); await page.getByRole('button',{name:'Close invitations'}).click();if(hadChat)await page.getByRole('button',{name:'Chat',exact:true}).click();return url; }
test('four browsers exchange actual WebRTC tracks, chat, mute and cleanup',async({browser,page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page);const invite=await invitation(page);
 const contexts=[],pages=[page];
 for(let i=1;i<4;i++){const context=await browser.newContext({permissions:['camera','microphone']});contexts.push(context);const guest=await context.newPage();pages.push(guest);await open(guest,invite,`Guest ${i}`);}
 for(const p of pages) await expect.poll(()=>p.locator('video').evaluateAll(videos=>videos.filter(v=>v.srcObject?.getTracks().some(t=>t.readyState==='live') && v.readyState >= 2 && v.videoWidth > 0).length),{timeout:20000}).toBe(4);
 await page.screenshot({path:'docs/screenshots/gallery.png'});
 await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{window.testScreen=await navigator.mediaDevices.getUserMedia({video:true,audio:false});return window.testScreen;};});
 await page.getByRole('button',{name:'Share screen',exact:true}).click();
 await expect.poll(()=>pages[1].locator('video').count()).toBe(5);
 await page.evaluate(()=>window.testScreen.getVideoTracks()[0].dispatchEvent(new Event('ended')));
 await expect.poll(()=>pages[1].locator('video').count()).toBe(4);
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('<script>hello</script>');await page.getByRole('button',{name:'Send message'}).click();
 await expect(pages[1].getByText('<script>hello</script>',{exact:true})).toBeVisible();
 await pages[1].getByRole('button',{name:'Mute microphone',exact:true}).click();await expect(pages[1].getByRole('button',{name:'Unmute microphone',exact:true})).toBeVisible();
 await pages[1].getByRole('button',{name:'Stop camera',exact:true}).click();await expect(pages[1].getByRole('button',{name:'Start camera',exact:true})).toBeVisible();
 await pages[3].getByRole('button',{name:'Leave',exact:true}).click();await expect(pages[3].getByRole('button',{name:'Join meeting',exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('video').count()).toBe(3);
 for(const context of contexts) await context.close();
 await page.getByRole('button',{name:'Leave',exact:true}).click();expect(errors).toEqual([]);
});
test('no-media join, guest moderation denial, screen cancel and leave/rejoin',async({page,browser})=>{
 await open(page,'/','Host',false);const invite=await invitation(page);
 await expect(page.getByRole('button',{name:'Unmute microphone',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeDisabled();
 const context=await browser.newContext();const guest=await context.newPage();await open(guest,invite,'Guest',false);
 await page.getByRole('button',{name:'Raise hand',exact:true}).click();await expect(page.getByRole('button',{name:'Lower hand',exact:true})).toHaveAttribute('aria-pressed','true');await expect(guest.getByText('Hand raised',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Lower hand',exact:true}).click();await expect(guest.getByText('Hand raised',{exact:true})).toHaveCount(0);
 await guest.getByRole('button',{name:'People',exact:true}).click();await expect(guest.getByRole('button',{name:'Remove',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{throw new DOMException('Cancelled','NotAllowedError');};});
 await page.getByRole('button',{name:'Share screen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Screen sharing was cancelled');
 await guest.getByRole('button',{name:'Leave',exact:true}).click();await guest.getByLabel('Use camera and microphone').uncheck();await guest.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();await guest.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(guest.getByRole('button',{name:'Leave',exact:true})).toBeVisible();await context.close();
});
test('denied camera permission remains recoverable without media',async({page})=>{
 await page.goto('/');const create=page.locator('form').filter({has:page.getByRole('button',{name:'Create meeting',exact:true})});await create.getByRole('checkbox').check();await create.getByRole('button').click();
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
 await page.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByText('Camera or microphone unavailable. Allow browser access or join without media.')).toBeVisible();
 await page.getByLabel('Use camera and microphone').uncheck();await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
});

test('temporary transport loss rejoins and republishes media',async({page,request})=>{
 await open(page);await request.post('http://127.0.0.1:8092/drop');
 await expect(page.getByRole('status')).toHaveText('Reconnecting to the meeting…');
 await expect(page.getByRole('status')).toHaveCount(0,{timeout:10000});
 await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('video').evaluateAll(v=>v.filter(e=>e.srcObject?.active).length)).toBe(1);
});
test('mobile lobby and controls remain accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'/','Mobile guest',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'People',exact:true}).click();await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
 await page.screenshot({path:'docs/screenshots/mobile.png'});
});

test('private invitations join the same room and reject missing/wrong access keys', async({page,browser})=>{
 await open(page,'/','Private host',false);const url=await invitation(page);expect(page.url()).toBe(url);expect(new URL(url).searchParams.get('key')).toHaveLength(64);
 const context=await browser.newContext();const guest=await context.newPage();const missing=new URL(url);missing.searchParams.delete('key');await guest.goto(missing.href);const form=guest.locator('form');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Open meeting'}).click();await expect(guest.getByRole('alert')).toContainText('requires its access key');
 const wrong=new URL(url);wrong.searchParams.set('key','incorrect');await guest.goto(wrong.href);await guest.locator('form').getByRole('checkbox').check();await guest.getByRole('button',{name:'Open meeting'}).click();await expect(guest.getByRole('alert')).toBeVisible();
 await open(guest,url,'Invited guest',false);await expect(page.locator('.vwc-tile')).toHaveCount(2);await expect(guest.locator('.vwc-tile')).toHaveCount(2);await page.reload();await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeVisible();expect(page.url()).toBe(url);await context.close();
});
test('only joined public rooms appear in the directory and a pasted link joins the same room',async({page,browser})=>{
 await page.goto('/');const form=page.locator('form').filter({has:page.getByRole('button',{name:'Create meeting',exact:true})});await form.getByLabel('Room title').fill('Open test room');await form.getByLabel('Room access').selectOption('public');await form.getByRole('checkbox').check();await form.getByRole('button').click();
 const c=await browser.newContext();const visitor=await c.newPage();await visitor.goto('/');await expect(visitor.getByRole('link',{name:'Open test room',exact:true})).toHaveCount(0);
 await page.getByLabel('Use camera and microphone').uncheck();await page.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();await page.getByRole('button',{name:'Join meeting',exact:true}).click();const invite=await invitation(page);expect(new URL(invite).searchParams.has('key')).toBe(false);
 await expect.poll(async()=>{await visitor.reload();return visitor.getByRole('link',{name:'Open test room',exact:true}).count();}).toBe(1);
 const join=visitor.locator('form').filter({has:visitor.getByRole('button',{name:'Open meeting',exact:true})});await join.getByLabel('Invitation link or room name').fill(invite);await join.getByRole('checkbox').check();await join.getByRole('button').click();await visitor.getByLabel('Use camera and microphone').uncheck();await visitor.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();await visitor.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.locator('.vwc-tile')).toHaveCount(2);
 await visitor.getByRole('button',{name:'Leave',exact:true}).click();await page.getByRole('button',{name:'Leave',exact:true}).click();await visitor.goto('/');await expect.poll(async()=>{await visitor.reload();return visitor.getByRole('link',{name:'Open test room',exact:true}).count();}).toBe(0);await c.close();
});
test('theme defaults to system and narrow chat stays below the media without overlap',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByRole('button',{name:'Theme: system. Switch to light.'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.getByRole('button',{name:'Theme: light. Switch to dark.'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByRole('button',{name:'Theme: dark. Switch to system.'}).click();
 await page.setViewportSize({width:390,height:844});await open(page,'/','Narrow host',false);const panel=await page.locator('.vwc-panel').boundingBox(),stage=await page.locator('.vwc-stage').boundingBox();expect(panel.y).toBeGreaterThanOrEqual(stage.y+stage.height-1);expect(stage.height).toBeGreaterThan(180);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Theme: system. Switch to light.'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.setViewportSize({width:320,height:640});await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/screenshots/mobile.png'});
});

test('UTF-8 room titles survive creation and refresh without splitting characters',async({page})=>{
 const title='A'+'ă'.repeat(40);await page.goto('/');const form=page.locator('form').filter({has:page.getByRole('button',{name:'Create meeting',exact:true})});await form.getByLabel('Room title').fill(title);await form.getByRole('checkbox').check();await form.getByRole('button').click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();const url=page.url();await page.reload();expect(page.url()).toBe(url);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
});
