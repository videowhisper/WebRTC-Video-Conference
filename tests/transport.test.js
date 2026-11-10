import { describe, it, expect, vi } from 'vitest';
import { MeshTransport, createStreamId, stopStream } from '../src/services/meshTransport';
function fixture() {
 const peers=[]; const socket={connected:true,emit:vi.fn()};
 const mesh=new MeshTransport({socket,config:{channel:'room',username:'me'},getPeerConfig:()=>({iceServers:[]}),onRemote:vi.fn(),onRemove:vi.fn(),createPeer:()=>{
  const pc={addTrack:vi.fn(),close:vi.fn(),createOffer:async()=>({type:'offer',sdp:'offer'}),createAnswer:async()=>({type:'answer',sdp:'answer'}),
   setLocalDescription:async function(d){this.localDescription=d;},setRemoteDescription:async function(d){this.remoteDescription=d;},addIceCandidate:vi.fn(async()=>{})};peers.push(pc);return pc;
 }});return {mesh,socket,peers};
}
describe('mesh lifecycle',()=>{
 it('publishes separate camera and screen channels and does not reuse camera for screen',async()=>{
  const {mesh,peers}=fixture(), camera={getTracks:()=>['camera']}, screen={getTracks:()=>['screen']};
  mesh.publish('camera',camera);mesh.publish('screen',screen);await mesh.offer('guest','room:me:screen');expect(peers[0].addTrack).toHaveBeenCalledWith('screen',screen);
 });
 it('queues ICE before remote descriptions and drains after answer',async()=>{
  const {mesh,peers}=fixture();mesh.publish('camera',{getTracks:()=>[]});await mesh.offer('guest','room:me:camera');
  await mesh.signal({type:'candidate',channel:'room:me:camera',from:'guest',candidate:{candidate:'candidate'}});
  expect(peers[0].addIceCandidate).not.toHaveBeenCalled();
  await mesh.signal({type:'answer',channel:'room:me:camera',from:'guest',content:{type:'answer',sdp:'answer'}});expect(peers[0].addIceCandidate).toHaveBeenCalledTimes(1);
 });
 it('closes every peer and clears pending state on reconnect and leave',async()=>{
  const {mesh,peers}=fixture();mesh.publish('camera',{getTracks:()=>[]});await mesh.offer('guest','room:me:camera');mesh.reset();expect(peers[0].close).toHaveBeenCalled();expect(mesh.outgoing.size).toBe(0);expect(mesh.pendingCandidates.size).toBe(0);expect(mesh.published.size).toBe(0);
 });
 it('stops tracks, detaches screen-ended callbacks, and uses stable channel IDs',()=>{
  const track={stop:vi.fn(),onended:()=>{}};stopStream({getTracks:()=>[track]});expect(track.stop).toHaveBeenCalled();expect(track.onended).toBeNull();expect(createStreamId('room','me','screen')).toBe('room:me:screen');
 });
});
