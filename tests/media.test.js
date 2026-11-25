import { it, expect, vi, afterEach } from 'vitest';
import { captureConstraints, captureMedia, mediaFailure, connectionSnapshot } from '../src/services/mediaDevices';
import { MeshTransport } from '../src/services/meshTransport';
afterEach(()=>vi.unstubAllGlobals());
it('uses selected device constraints, supports no-camera/microphone and accepts old profile input',()=>{
 expect(captureConstraints({framerate:12},{camera:'cam',microphone:'mic'})).toMatchObject({audio:{deviceId:{exact:'mic'}},video:{deviceId:{exact:'cam'},frameRate:{ideal:12,max:12}}});
 expect(captureConstraints({frameRate:10,framerate:25},{camera:'none'})).toMatchObject({audio:true,video:false});
 expect(captureConstraints({frameRate:-1},{microphone:'none'})).toMatchObject({audio:false,video:{frameRate:{max:15}}});
});
it('fails without secure media APIs, and never exposes raw device errors',async()=>{
 vi.stubGlobal('window',{isSecureContext:false});
 await expect(captureMedia({}, {}, {getUserMedia:vi.fn()})).rejects.toMatchObject({name:'MediaUnsupported'});
 vi.stubGlobal('window',{isSecureContext:true});
 expect(mediaFailure({name:'NotAllowedError',message:'private-device-ID-secret'})).not.toContain('secret');
 expect(mediaFailure({name:'NotReadableError'})).toContain('busy');
});
it('counts only connected decoded media and the selected route, redacting addresses and credentials',async()=>{
 const rows=new Map([['transport',{type:'transport',selectedCandidatePairId:'chosen'}],['old',{id:'old',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'direct'}],['direct',{type:'local-candidate',candidateType:'host',address:'192.0.2.1',url:'private-credential'}],['relay',{candidateType:'relay',address:'198.51.100.2'}],['chosen',{id:'chosen',type:'candidate-pair',state:'succeeded',localCandidateId:'relay',remoteCandidateId:'direct',currentRoundTripTime:.025}],['video',{type:'inbound-rtp',kind:'video',bytesReceived:5000,framesDecoded:20,packetsLost:2}],['audio',{type:'inbound-rtp',kind:'audio',bytesReceived:1000}],['send',{type:'outbound-rtp',kind:'video',framesEncoded:30}]]);
 const peer={connectionState:'new',getStats:vi.fn(async()=>rows)};
 const negative=await connectionSnapshot([peer],null,1000);expect(negative.videoFramesReceived).toBe(0);expect(peer.getStats).not.toHaveBeenCalled();
 peer.connectionState='connected';const stats=await connectionSnapshot([peer],negative,2000);
 expect(stats).toMatchObject({connectedPeers:1,videoFramesReceived:20,videoFramesSent:30,audioBytesReceived:1000,route:'relay',roundTripMs:25,packetsLost:2});
 expect(JSON.stringify(stats)).not.toMatch(/192\.0|198\.51|private-credential|address/);
});
it('replaces same-kind sender tracks without renegotiating and rolls back a partial failure',async()=>{
 const oldAudio={kind:'audio'},oldVideo={kind:'video'},newAudio={kind:'audio'},newVideo={kind:'video'};
 const old={getTracks:()=>[oldAudio,oldVideo]},fresh={getTracks:()=>[newAudio,newVideo]};
 const audio={track:oldAudio,replaceTrack:vi.fn(async()=>{})},video={track:oldVideo,replaceTrack:vi.fn(async()=>{})};
 const socket={connected:true,emit:vi.fn()},mesh=new MeshTransport({socket,config:{channel:'r',username:'me'},getPeerConfig:()=>({}),onRemove:vi.fn()});
 mesh.publish('camera',old);mesh.outgoing.set(JSON.stringify(['r:me:camera','guest']),{getSenders:()=>[audio,video]});socket.emit.mockClear();
 await mesh.replaceStream('camera',fresh);expect(audio.replaceTrack).toHaveBeenCalledWith(newAudio);expect(mesh.local.get('r:me:camera')).toBe(fresh);expect(socket.emit).not.toHaveBeenCalled();
 mesh.local.set('r:me:camera',old);audio.replaceTrack.mockClear();video.replaceTrack.mockRejectedValueOnce(new Error('synthetic'));
 await expect(mesh.replaceStream('camera',fresh)).rejects.toThrow('synthetic');expect(audio.replaceTrack).toHaveBeenLastCalledWith(oldAudio);expect(mesh.local.get('r:me:camera')).toBe(old);
});
it('does not publish empty media and cannot restore stream references after reset during replacement',async()=>{
 const oldTrack={kind:'video'},freshTrack={kind:'video'},old={getTracks:()=>[oldTrack]},fresh={getTracks:()=>[freshTrack]};
 const socket={connected:true,emit:vi.fn()},mesh=new MeshTransport({socket,config:{channel:'r',username:'me'},getPeerConfig:()=>({}),onRemove:vi.fn()});
 mesh.publish('camera',{getTracks:()=>[]});expect(socket.emit).not.toHaveBeenCalled();mesh.publish('camera',old);
 let resolve;const sender={track:oldTrack,replaceTrack:()=>new Promise(done=>{resolve=done;})};mesh.outgoing.set(JSON.stringify(['r:me:camera','guest']),{getSenders:()=>[sender],close:vi.fn()});
 const change=mesh.replaceStream('camera',fresh);mesh.reset();resolve();await expect(change).rejects.toMatchObject({name:'AbortError'});expect(mesh.local.size).toBe(0);expect(mesh.outgoing.size).toBe(0);
});
