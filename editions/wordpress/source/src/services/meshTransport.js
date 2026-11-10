export function createStreamId(room, username, kind) { return `${room}:${username}:${kind}`; }
export function stopStream(stream) { stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); }

// One transport per application; media state is independent of React views.
export class MeshTransport {
  constructor({ socket, config, getPeerConfig, onRemote, onRemove, createPeer = config => new RTCPeerConnection(config) }) {
    Object.assign(this, { socket, config, getPeerConfig, onRemote, onRemove, createPeer });
    this.local = new Map(); this.outgoing = new Map(); this.incoming = new Map();
    this.published = new Set(); this.pendingCandidates = new Map(); this.epoch = 0;
  }
  emit(type, target, channel, data) {
    if (this.socket.connected) this.socket.emit('messagePeer', { type, target, channel, ...data });
  }
  close(pc) { if (pc) { pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null; pc.close(); } }
  key(channel, user) { return JSON.stringify([channel, user]); }
  wire(pc, target, channel) { pc.onicecandidate = ({ candidate }) => { if (candidate) this.emit('candidate', target, channel, { candidate }); }; }
  async flush(pc, key) {
    const candidates = this.pendingCandidates.get(key) || []; this.pendingCandidates.delete(key);
    for (const candidate of candidates) await pc.addIceCandidate(candidate);
  }
  async offer(peerID, channel) {
    const stream = this.local.get(channel);
    if (!stream || peerID === this.config.username) return;
    const key = this.key(channel, peerID);
    if (this.outgoing.has(key)) return;
    const epoch = this.epoch, pc = this.createPeer(this.getPeerConfig());
    this.outgoing.set(key, pc); this.wire(pc, peerID, channel);
    stream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, stream);
      if (sender?.getParameters && sender?.setParameters) {
        const parameters = sender.getParameters();
        if (!parameters.encodings?.length) parameters.encodings = [{}];
        parameters.encodings[0].maxBitrate = (track.kind === 'audio' ? this.config.stream?.audioBitrate || 32 : this.config.stream?.videoBitrate || 180) * 1000;
        sender.setParameters(parameters).catch(() => {});
      }
    });
    await pc.setLocalDescription(await pc.createOffer());
    if (epoch === this.epoch && this.outgoing.get(key) === pc) this.emit('offer', peerID, channel, { content: pc.localDescription });
  }
  async signal(message) {
    if (!message?.channel) return;
    const { channel, from, type } = message;
    if (type === 'peers') { await Promise.all((message.peers || []).map(p => this.offer(p.peerID, channel))); return; }
    if (type === 'peer') { await this.offer(message.peerID, channel); return; }
    const key = this.key(channel, from);
    if (type === 'offer') {
      const epoch = this.epoch; this.close(this.incoming.get(key));
      const pc = this.createPeer(this.getPeerConfig()); this.incoming.set(key, pc); this.wire(pc, from, channel);
      pc.ontrack = ({ streams }) => { if (streams[0]) this.onRemote(channel, { user: from, mediaStream: streams[0], connectionState: pc.connectionState }); };
      pc.onconnectionstatechange = () => this.onRemote(channel, { connectionState: pc.connectionState });
      await pc.setRemoteDescription(message.content); await this.flush(pc, key);
      await pc.setLocalDescription(await pc.createAnswer());
      if (epoch === this.epoch && this.incoming.get(key) === pc) this.emit('answer', from, channel, { content: pc.localDescription });
    } else if (type === 'answer') {
      const pc = this.outgoing.get(key); if (pc) { await pc.setRemoteDescription(message.content); await this.flush(pc, key); }
    } else if (type === 'candidate' && message.candidate) {
      const pc = this.outgoing.get(key) || this.incoming.get(key);
      if (pc?.remoteDescription) await pc.addIceCandidate(message.candidate);
      else { const queue = this.pendingCandidates.get(key) || []; if (queue.length < 128) this.pendingCandidates.set(key, [...queue, message.candidate]); }
    }
  }
  publish(kind, stream) {
    const channel = createStreamId(this.config.channel, this.config.username, kind);
    this.local.set(channel, stream);
    if (!this.socket.connected || this.published.has(channel)) return;
    this.published.add(channel);
    const p = this.config.stream || {};
    this.socket.emit('roomPublish', { room: this.config.channel, stream: channel, parameters: {
      type: 'webrtc', kind, width: p.width || 640, height: p.height || 360,
      frameRate: p.framerate || 15, videoBitrate: p.videoBitrate || 180, audioBitrate: p.audioBitrate || 32,
    } });
  }
  remove(channel) {
    for (const peers of [this.outgoing, this.incoming]) for (const [key, pc] of peers) {
      if (JSON.parse(key)[0] === channel) { this.close(pc); peers.delete(key); this.pendingCandidates.delete(key); }
    }
    this.onRemove(channel);
  }
  removeUser(user) {
    for (const peers of [this.outgoing, this.incoming]) for (const [key, pc] of peers) {
      if (JSON.parse(key)[1] === user) { this.close(pc); peers.delete(key); this.pendingCandidates.delete(key); }
    }
  }
  unpublish(kind) {
    const channel = createStreamId(this.config.channel, this.config.username, kind);
    if (this.socket.connected) this.socket.emit('roomUnpublish', { room: this.config.channel, stream: channel });
    this.local.delete(channel); this.published.delete(channel); this.remove(channel);
  }
  reset() {
    this.epoch++;
    for (const peers of [this.outgoing, this.incoming]) { for (const pc of peers.values()) this.close(pc); peers.clear(); }
    this.pendingCandidates.clear(); this.published.clear();
  }
}
