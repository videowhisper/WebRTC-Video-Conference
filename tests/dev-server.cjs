// Local-only integration harness. No production env files, accounts, certificates or database.
const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Server } = require('socket.io');
const { createConference, validateClaims } = require('./fixtures/conference.cjs');
const storage=mkdtempSync(path.join(tmpdir(),'vwc-integration-'));
const account='conference_test',token=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex');
const php=spawn('php',['-S','127.0.0.1:8091','-t',path.join(__dirname,'../editions/php')],{env:{...process.env,VWC_ACCOUNT:account,VWC_ACCOUNT_TOKEN:token,VWC_SIGNING_KEY:key,VWC_SOCKET_URL:'http://127.0.0.1:8092',VWC_STORAGE_DIR:storage},stdio:'ignore'});
const server=http.createServer((req,res)=>{if(req.method==='POST' && req.url==='/reset')require('node:fs').rmSync(path.join(storage,'rooms.json'),{force:true});if(req.method==='POST' && req.url==='/drop'){for(const s of nsp.sockets.values())s.conn.close();}res.writeHead(200);res.end('local conference fixture');});
const io=new Server(server,{cors:{origin:['http://127.0.0.1:8091','http://localhost:8091']},maxHttpBufferSize:120000});
const nsp=io.of('/conference');
const conference=createConference({getPlan:()=>({connections:40,totalBitrate:50000})});
nsp.use(async(socket,next)=>{
 try {
  const auth=socket.handshake.auth;
  const wp = auth.account === 'wordpress_test' && process.env.VWC_WP_TEST_URL;
  if(auth.account!==account && !wp) return next(new Error('Authentication failed'));
  const response=await fetch(wp ? process.env.VWC_WP_TEST_URL + '/?rest_route=/videowhisper-conference/v1/auth' : 'http://127.0.0.1:8091/?action=auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...auth,token:wp ? 'local-wordpress-test-token' : token})});
  const result=await response.json();
  if(!result.login || !validateClaims(result.conference)) return next(new Error('Authentication failed'));
  socket.account=auth.account;socket.user=auth.user;socket.conference=result.conference;next();
 }catch{next(new Error('Authentication failed'));}
});
nsp.on('connection',socket=>conference.setup(socket));
server.listen(8092,'127.0.0.1',()=>process.stdout.write('Local conference fixture ready\n'));
function close(){php.kill();io.close();server.close();rmSync(storage,{recursive:true,force:true});}
process.on('SIGTERM',()=>{close();process.exit(0);});process.on('SIGINT',()=>{close();process.exit(0);});
