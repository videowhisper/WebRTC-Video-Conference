// Isolated PHP callback/lifecycle check. Uses only random synthetic credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
test('PHP callback rejects idle room credentials and page requests release their slots', async () => {
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const storage=mkdtempSync(join(tmpdir(),'vwc-http-')),token=randomBytes(32).toString('hex'),base=`http://127.0.0.1:${port}/`;
 const php=spawn('php',['-S',`127.0.0.1:${port}`,'-t',join(__dirname,'../editions/php')],{env:{...process.env,VWC_ACCOUNT:'http_fixture',VWC_ACCOUNT_TOKEN:token,VWC_SIGNING_KEY:randomBytes(32).toString('hex'),VWC_SOCKET_URL:'http://127.0.0.1:8092',VWC_STORAGE_DIR:storage,VWC_ROOM_IDLE_SECONDS:'300'},stdio:'ignore'});
 try {
  let page;
  for(let i=0;i<100;i++){try{page=await fetch(base);break;}catch{await new Promise(resolve=>setTimeout(resolve,20));}}
  assert.ok(page,'PHP fixture did not start');const cookie=page.headers.get('set-cookie').split(';')[0],html=await page.text(),csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const created=await fetch(base,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,consent:'1',operation:'create',access:'public'}),redirect:'manual'});assert.equal(created.status,303);
  const invite=created.headers.get('location'),lobby=await (await fetch(invite,{headers:{cookie}})).text();
  const config=JSON.parse(lobby.match(/window\.videowhisperConfig=(\{.*?\});<\/script>/s)[1]);
  const auth={...config.videowhisperServer,user:config.username,token};
  async function login(){return (await fetch(base+'?action=auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(auth)})).json();}
  assert.equal((await login()).login,true);
  const ledger=join(storage,'rooms.json'),state=JSON.parse(readFileSync(ledger,'utf8'));state.rooms[config.channel].lastActive=Math.floor(Date.now()/1000)-301;writeFileSync(ledger,JSON.stringify(state));
  assert.equal((await login()).login,false,'Idle reservation still authenticates');
  const expired=await (await fetch(invite,{headers:{cookie},method:'POST',body:new URLSearchParams({csrf,consent:'1',operation:'join',room:config.channel})})).text();
  assert.ok(expired.includes('does not exist or has expired'));assert.equal(Object.keys(JSON.parse(readFileSync(ledger,'utf8')).rooms).length,0);
 } finally {
  const closed=new Promise(resolve=>php.once('exit',resolve));php.kill();await closed;rmSync(storage,{recursive:true,force:true});
 }
});
