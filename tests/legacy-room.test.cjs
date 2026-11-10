const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const legacy=path.resolve(__dirname,'../../videowhisper-webrtc/modules/room.js');
function fixture(){
 const sockets=new Map(),subscribed=[],unpublished=[];
 const io={to:room=>({emit:(event,data)=>{for(const s of sockets.values())if(s.rooms.has(room))s.events.push({event,data});}})};
 const room=require(legacy)(io,{publish:()=>true,unpublish:(...args)=>unpublished.push(args),subscribeToChannel:(...args)=>subscribed.push(args)},{},{},{},false);
 function client(id){const handlers={},s={id,user:id,account:'legacy',rooms:new Set(),events:[],on:(e,f)=>handlers[e]=f,emit:(event,data)=>s.events.push({event,data}),join:r=>s.rooms.add(r),leave:r=>s.rooms.delete(r),send:(e,d)=>handlers[e](d)};sockets.set(id,s);room.setupRoomHandlers(s);return s;}
 return {client,subscribed,unpublished};
}
test('unchanged legacy room/call publish, subscribe, chat and leave contract',{skip:!fs.existsSync(legacy)},()=>{
 const {client,subscribed,unpublished}=fixture();const a=client('a'),b=client('b');
 a.send('roomJoin',{room:'LegacyCall',options:{maxParticipants:2,privateRoom:true}});b.send('roomJoin',{room:'LegacyCall'});
 assert.ok(a.events.some(e=>e.data.type==='roomJoin'));
 a.send('roomPublish',{room:'LegacyCall',stream:'legacyStream',parameters:{type:'webrtc'}});assert.equal(subscribed.length,1);
 b.send('roomMessage',{room:'LegacyCall',message:{body:'hello'}});assert.equal(a.events.at(-1).data.messageNew.body,'hello');
 a.send('roomLeave',{room:'LegacyCall'});assert.equal(unpublished.length,1);assert.ok(b.events.some(e=>e.data.streamRemove==='legacyStream'));b.send('roomLeave',{room:'LegacyCall'});
});
test('unchanged RandomChat queue still matches and returns private room metadata',{skip:!fs.existsSync(legacy)},()=>{
 const {client}=fixture();const a=client('a'),b=client('b');a.send('randomQueueJoin',{queue:'test'});b.send('randomQueueJoin',{queue:'test'});
 const match=a.events.find(e=>e.event==='matchFound');assert.ok(match);assert.equal(match.data.roomOptions.maxParticipants,2);
});
