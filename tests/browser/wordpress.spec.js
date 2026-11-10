import { test, expect } from '@playwright/test';
test('WordPress iframe uses guest and host callbacks with two-way media',async({page,browser})=>{
 test.skip(!process.env.VWC_WP_TEST_URL || !process.env.VWC_WP_MEETING,'Optional isolated wp-env integration');
 const wp=process.env.VWC_WP_TEST_URL,meeting=process.env.VWC_WP_MEETING;
 const url=`${wp}/wp-admin/admin-post.php?action=vwc_app&meeting=${meeting}`;
 await page.goto(`${wp}/wp-login.php`);await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();
 await page.goto(url);await page.getByLabel('Display name',{exact:true}).fill('Meeting owner');
 await page.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await page.getByRole('button',{name:'Join meeting',exact:true}).click();await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Invite',exact:true}).click();const invite=await page.getByLabel('Invitation link',{exact:true}).inputValue();expect(invite).toContain('/conference/');await page.getByRole('button',{name:'Close invitations'}).click();
 const context=await browser.newContext({permissions:['camera','microphone']});const guest=await context.newPage();const response=await guest.goto(invite);
 expect(response.headers()['cache-control']).toContain('no-store');
 expect(await guest.content()).not.toContain('local-wordpress-test-token');
 await guest.getByLabel('Display name',{exact:true}).fill('Invited guest');await guest.getByRole('checkbox',{name:'I agree to connect to the configured signaling service and share media with participants when enabled.'}).check();
 await guest.getByRole('button',{name:'Join meeting',exact:true}).click();
 await expect.poll(()=>guest.locator('video').evaluateAll(videos=>videos.filter(v=>v.srcObject?.getTracks().some(t=>t.readyState==='live')).length)).toBe(2);
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
 const list=await request.get(base+'/?post_type=vwc_meeting');expect(await list.text()).not.toContain('Private content canary');
 const embed=await request.get(base+'/?rest_route=/oembed/1.0/embed&url='+encodeURIComponent(base+routes.private));expect(embed.status()).toBe(404);
});
