const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createConference, validateClaims } = require('./fixtures/conference.cjs');
function fixture(options = {}) {
  const module = createConference(options);
  function client(id, role = 'guest', account = 'test', room = 'Meeting', extra = {}) {
    const handlers = {}, events = [];
    const s = { id, user: id, account, conference: { version: 1, room, role, maxParticipants: 4, expires: Math.floor(Date.now()/1000)+60, ...extra },
      on: (e, fn) => { handlers[e] = fn; }, emit: (e, data) => events.push({ e, data }),
      disconnect: () => handlers.disconnect(), send: (e, data) => handlers[e]?.(data), events };
    module.setup(s); s.send('roomJoin', { room, options: { participant: { role: 'host' }, permissions: { canModerate: true } } });
    return s;
  }
  return { module, client };
}
const profile = { type:'webrtc', kind:'camera', width:640,height:360,frameRate:15,videoBitrate:500,audioBitrate:32 };
test('server claims reject expired, oversized and malformed authorization', () => {
  assert.equal(validateClaims({ version:1,room:'x',role:'host',expires:1,maxParticipants:4 }),false);
  assert.equal(validateClaims({ version:1,room:'__proto__',role:'admin',expires:Date.now(),maxParticipants:400 }),false);
});
test('roles are authoritative; guests cannot escalate, unlock or remove', () => {
  const {client} = fixture(); const guest=client('guest'), host=client('host','host');
  guest.send('participantUpdate',{room:'Meeting',patch:{role:'host',permissions:{canModerate:true},mic:false}});
  assert.equal(guest.participant.role,'guest'); assert.equal(guest.participant.mic,false);
  guest.send('roomAction',{room:'Meeting',action:'removeParticipant',target:'host'});
  assert.equal(guest.events.at(-1).data.code,'actionDenied'); assert.ok(host.conferenceRoom);
  guest.disconnect(); host.disconnect();
});
test('account isolation, room authorization, capacity and duplicate sessions', () => {
  const {client,module}=fixture(); const users=[client('a'),client('b'),client('c'),client('d')];
  const full=client('e'); assert.equal(full.events.at(-1).data.code,'roomFull');
  const other=client('z','guest','other'); assert.equal(other.conferenceRoom.sockets.size,1);
  other.send('roomGetState',{room:'foreign'}); assert.equal(other.events.at(-1).data.code,'roomDenied');
  [...users,full,other].forEach(s=>s.disconnect()); assert.equal(module.rooms.size,0); assert.equal(module.sessions.size,0);
});
test('publish ownership, signaling identity, late join and cleanup', () => {
  const {client,module}=fixture();const a=client('a','host'),b=client('b');
  a.send('roomPublish',{room:'Meeting',stream:'Meeting:a:camera',parameters:profile});
  assert.equal(a.conferenceRoom.streams.size,1);
  b.send('roomPublish',{room:'Meeting',stream:'Meeting:a:camera',parameters:profile});assert.equal(b.events.at(-1).data.code,'publishDenied');
  a.send('messagePeer',{type:'offer',channel:'Meeting:a:camera',from:'spoof',target:'b',content:{type:'offer',sdp:'test'}});
  assert.equal(b.events.at(-1).data.from,'a');
  const c=client('c'); assert.ok(a.events.some(e=>e.data.peerID==='c'));
  c.send('messagePeer',{type:'answer',channel:'Meeting:a:camera',target:'b',content:{type:'answer',sdp:'test'}});assert.equal(c.events.at(-1).data.code,'signalDenied');
  a.disconnect();assert.equal(b.conferenceRoom.streams.size,0); b.disconnect(); c.disconnect();assert.equal(module.rooms.size,0);
});
test('lock, removal, bounded chat, malformed payload and resync', () => {
  const {client}=fixture();const host=client('host','host'),guest=client('guest');
  host.send('roomAction',{room:'Meeting',action:'lockRoom'});const denied=client('denied');assert.equal(denied.events.at(-1).data.code,'roomLocked');
  guest.send('roomMessage',{room:'Meeting',message:{body:'<img src=x onerror=alert(1)>',user:'spoof'}});
  assert.equal(host.events.at(-1).data.messageNew.user,'guest');
  guest.send('roomMessage',{room:'Meeting',message:{body:'x'.repeat(2001)}});assert.equal(guest.events.at(-1).data.code,'invalidMessage');
  guest.send('roomGetState',{room:'Meeting'}); assert.equal(guest.events.at(-1).data.type,'roomState');assert.equal(guest.events.at(-1).data.messages.length,1);
  guest.send('roomPublish',null); assert.equal(guest.events.at(-1).data.code,'invalidPayload');
  host.send('roomAction',{room:'Meeting',action:'removeParticipant',target:'guest'});assert.equal(guest.conferenceRoom,null);
  guest.send('roomJoin',{room:'Meeting'});assert.equal(guest.events.at(-1).data.code,'removedFromRoom');
  [host,guest,denied].forEach(s=>s.disconnect());
});
test('account connection limits fail closed',()=>{
  const module=createConference({getPlan:()=>({connections:1})});
  function socket(id){return {id,user:id,account:'a',conference:{version:1,room:'room',role:'guest',maxParticipants:4,expires:Math.floor(Date.now()/1000)+30},on(){},emit(){}};}
  module.setup(socket('one'));assert.throws(()=>module.setup(socket('two')),/connection limit/);
});

test('publication checks screen entitlement and bitrate plans',()=>{
 const {client}=fixture();const s=client('limited','guest','test','Meeting',{allowScreenShare:false});
 s.send('roomPublish',{room:'Meeting',stream:'Meeting:limited:screen',parameters:{...profile,kind:'screen'}});assert.equal(s.events.at(-1).data.code,'publishDenied');
 s.send('roomPublish',{room:'Meeting',stream:'Meeting:limited:camera',parameters:{...profile,videoBitrate:99999}});assert.equal(s.events.at(-1).data.code,'planLimit');s.disconnect();
});

test('four default publishers fit the developer budget and screen share needs headroom',()=>{
 const {client}=fixture({getPlan:()=>({connections:5,totalBitrate:2700,bitrate:500,framerate:15,width:640,height:360,audioBitrate:32})});
 const users=['a','b','c','d'].map(id=>client(id));
 for(const s of users) s.send('roomPublish',{room:'Meeting',stream:`Meeting:${s.user}:camera`,parameters:{...profile,videoBitrate:180}});
 assert.equal(users[0].conferenceRoom.streams.size,4);
 users[0].send('roomPublish',{room:'Meeting',stream:'Meeting:a:screen',parameters:{...profile,kind:'screen',videoBitrate:180}});
 assert.equal(users[0].events.at(-1).data.code,'planLimit');users.forEach(s=>s.disconnect());
});
