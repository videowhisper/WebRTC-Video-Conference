// Additive /conference namespace. No legacy room, broadcast or random-chat state is changed.
'use strict';
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(value);
const boolFields = ['mic', 'camera', 'hand', 'screen'];
const moderation = new Set(['requestMute', 'muteAll', 'removeParticipant', 'spotlight', 'lockRoom', 'unlockRoom']);

function validateClaims(claims, now = Date.now()) {
  return claims?.version === 1 && validId(claims.room) &&
    ['host', 'guest'].includes(claims.role) && Number.isSafeInteger(claims.expires) &&
    claims.expires * 1000 > now && claims.expires * 1000 <= now + 3600000 &&
    Number.isInteger(claims.maxParticipants) && claims.maxParticipants >= 2 && claims.maxParticipants <= 4;
}

function createConference({ peerConfig = { iceServers: [] }, getPlan = () => ({}), getLegacyUsage = () => ({}), onUsage = () => {}, onFailure = () => {} } = {}) {
  const rooms = new Map();
  const sessions = new Set();
  const started = new WeakMap();
  const playback = new WeakMap();
  const elapsed = (socket, field, start) => {
    const end = Date.now();
    if (Number.isFinite(start) && end > start) onUsage(socket.account, { [field]: (end - start) / 1000, startTime: start, endTime: end, protocol: 'conference-signaling' });
  };
  const usage = (account) => [...sessions].filter(s => s.account === account);
  const snapshot = (room) => ({ participants: Object.fromEntries([...room.sockets].map(([id, s]) => [id, s.participant])),
    streams: Object.fromEntries(room.streams), messages: room.messages.slice(-100),
    meta: { createdAt: room.createdAt, locked: room.locked, maxParticipants: room.limit, spotlighted: room.spotlighted } });
  const send = (socket, data) => socket.emit('roomUpdate', { room: socket.conference.room, ...data });
  const broadcast = (room, data) => {
    room.revision++;
    for (const s of room.sockets.values()) send(s, { ...data, revision: room.revision });
  };
  const removeStream = (room, id) => {
    const stream = room.streams.get(id); if (!stream) return;
    const owner = room.sockets.get(stream.socketId);
    if (owner) elapsed(owner, 'duration', started.get(stream));
    for (const socket of room.sockets.values()) {
      const entries = playback.get(socket);
      if (entries?.has(id)) { elapsed(socket, 'durationPlay', entries.get(id)); entries.delete(id); }
    }
    room.streams.delete(id); broadcast(room, { streamRemove: id });
  };
  const leave = (socket) => {
    const room = socket.conferenceRoom;
    if (!room) return;
    for (const [id, stream] of room.streams) if (stream.socketId === socket.id) removeStream(room, id);
    for (const start of playback.get(socket)?.values() || []) elapsed(socket, 'durationPlay', start);
    playback.get(socket)?.clear();
    room.sockets.delete(socket.id);
    socket.conferenceRoom = null;
    broadcast(room, { participantLeft: socket.participant });
    if (!room.sockets.size) rooms.delete(room.key);
  };
  function setup(socket) {
    if (!validateClaims(socket.conference) || !validId(socket.user) || !socket.account) throw new Error('Conference authorization required');
    const plan = getPlan(socket.account) || {};
    const legacy = getLegacyUsage(socket.account) || {};
    if (plan.connections && usage(socket.account).length + (legacy.connections || 0) >= plan.connections) throw new Error('Account connection limit reached');
    sessions.add(socket);
    const expiry = setTimeout(() => {
      send(socket, { type: 'sessionExpired', code: 'sessionExpired' });
      leave(socket);
      socket.disconnect(true);
    }, socket.conference.expires * 1000 - Date.now());
    expiry.unref?.();
    const fail = (code) => { if (['publishDenied', 'planLimit'].includes(code)) onFailure(socket.account); send(socket, { type: 'error', code }); };
    let windowStart = Date.now(), count = 0;
    const on = (event, handler) => socket.on(event, (data) => {
      if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); count = 0; }
      if (++count > 160) return fail('rateLimited');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('invalidPayload');
      if (socket.conference.expires * 1000 <= Date.now()) return fail('sessionExpired');
      if (event !== 'messagePeer' && data.room !== socket.conference.room) return fail('roomDenied');
      handler(data);
    });
    const member = () => {
      if (socket.conferenceRoom) return socket.conferenceRoom;
      fail('notJoined');
      return null;
    };
    socket.emit('conferenceReady', { version: 1, peerConfig, expires: socket.conference.expires });
    on('roomJoin', ({ options = {} }) => {
      if (socket.conferenceRoom) {
        send(socket, { type: 'roomState', ...snapshot(socket.conferenceRoom) });
        return;
      }
      const key = JSON.stringify([socket.account, socket.conference.room]);
      let room = rooms.get(key);
      if (!room) {
        room = { key, sockets: new Map(), streams: new Map(), messages: [], banned: new Set(), createdAt: Date.now(),
          limit: socket.conference.maxParticipants, locked: false, revision: 0, spotlighted: null };
        rooms.set(key, room);
      }
      if (room.banned.has(socket.user)) return fail('removedFromRoom');
      if (room.locked && socket.conference.role !== 'host') return fail('roomLocked');
      if (room.sockets.size >= Math.min(room.limit, socket.conference.maxParticipants)) return fail('roomFull');
      if ([...room.sockets.values()].some(s => s.user === socket.user)) return fail('duplicateUser');
      socket.participant = { id: socket.id, name: socket.user,
        displayName: typeof options?.participant?.displayName === 'string' ? options.participant.displayName.slice(0, 80) : socket.user,
        role: socket.conference.role, mic: true, camera: true, hand: false, joinedAt: Date.now(),
        permissions: { canModerate: socket.conference.role === 'host' } };
      room.sockets.set(socket.id, socket);
      socket.conferenceRoom = room;
      playback.set(socket, new Map([...room.streams.keys()].map(id => [id, Date.now()])));
      send(socket, { type: 'roomJoin', ...snapshot(room), revision: room.revision });
      broadcast(room, { participantJoin: socket.participant });
      for (const stream of room.streams.values()) {
        room.sockets.get(stream.socketId)?.emit('message', { type: 'peer', peerID: socket.user, channel: stream.channel });
      }
    });
    on('roomLeave', () => leave(socket));
    on('roomGetState', () => { const room = member(); if (room) send(socket, { type: 'roomState', ...snapshot(room), revision: room.revision }); });
    on('roomPublish', ({ stream, parameters }) => {
      const room = member(); if (!room) return;
      const kind = parameters?.kind;
      if (!['camera', 'screen'].includes(kind) || stream !== `${socket.conference.room}:${socket.user}:${kind}`) return fail('publishDenied');
      if (kind === 'screen' && socket.conference.allowScreenShare === false) return fail('publishDenied');
      if (room.streams.has(stream)) return;
      const limits = { width: 640, height: 360, frameRate: 15, videoBitrate: 500, audioBitrate: 32 };
      for (const [field, fallback] of Object.entries(limits)) {
        const maximum = Math.min(fallback, Number(field === 'frameRate' ? (plan.frameRate || plan.framerate) : plan[field === 'videoBitrate' ? 'bitrate' : field]) || fallback);
        if (!Number.isFinite(parameters[field]) || parameters[field] < 0 || parameters[field] > maximum) return fail('planLimit');
      }
      // Reserve a conservative four-way mesh budget for each published stream.
      const active = usage(socket.account).flatMap(s => s.conferenceRoom ? [...s.conferenceRoom.streams.values()].filter(st => st.socketId === s.id) : []);
      const bitrate = active.reduce((n, st) => n + (st.videoBitrate + st.audioBitrate) * 3, 0) + (parameters.videoBitrate + parameters.audioBitrate) * 3;
      const currentLegacy = getLegacyUsage(socket.account) || {};
      if (plan.totalBitrate && bitrate + (currentLegacy.bitrate || 0) + (currentLegacy.audioBitrate || 0) > plan.totalBitrate) return fail('planLimit');
      const info = { streamId: stream, channel: stream, user: socket.user, socketId: socket.id, kind, type: 'webrtc',
        videoBitrate: parameters.videoBitrate, audioBitrate: parameters.audioBitrate };
      room.streams.set(stream, info);
      started.set(info, Date.now());
      for (const other of room.sockets.values()) if (other !== socket) playback.get(other).set(stream, Date.now());
      broadcast(room, { streamNew: info });
      socket.emit('message', { type: 'peers', channel: stream, peers: [...room.sockets.values()].filter(s => s !== socket).map(s => ({ peerID: s.user })) });
    });
    on('roomUnpublish', ({ stream }) => { const room = member(); if (room?.streams.get(stream)?.socketId === socket.id) removeStream(room, stream); });
    on('participantUpdate', ({ patch }) => {
      const room = member(); if (!room || !patch || typeof patch !== 'object') return;
      for (const field of boolFields) if (typeof patch[field] === 'boolean') socket.participant[field] = patch[field];
      broadcast(room, { participantUpdate: { id: socket.id, participant: socket.participant } });
    });
    on('roomMessage', ({ message }) => {
      const room = member(); if (!room) return;
      if (typeof message?.body !== 'string' || !message.body.trim() || message.body.length > 2000) return fail('invalidMessage');
      const item = { user: socket.user, displayName: socket.participant.displayName, body: message.body.trim(), timestamp: Date.now() };
      room.messages.push(item); room.messages = room.messages.slice(-100);
      broadcast(room, { messageNew: item });
    });
    on('roomAction', ({ action, target }) => {
      const room = member(); if (!room) return;
      if (action === 'raiseHand' || action === 'lowerHand') {
        socket.participant.hand = action === 'raiseHand';
        broadcast(room, { participantUpdate: { id: socket.id, participant: socket.participant } });
        return;
      }
      if (!moderation.has(action) || socket.conference.role !== 'host') return fail('actionDenied');
      if (action === 'lockRoom' || action === 'unlockRoom') room.locked = action === 'lockRoom';
      if (action === 'spotlight') room.spotlighted = [...room.sockets.values()].some(s => s.user === target) ? target : null;
      if (action === 'requestMute') { const s = room.sockets.get(target); if (s) send(s, { type: 'muteRequested' }); }
      if (action === 'muteAll') for (const s of room.sockets.values()) if (s !== socket) send(s, { type: 'muteRequested' });
      if (action === 'removeParticipant') {
        const s = room.sockets.get(target);
        if (s && s !== socket) { room.banned.add(s.user); send(s, { type: 'removedFromRoom', code: 'removedFromRoom' }); leave(s); }
      }
      broadcast(room, { meta: snapshot(room).meta });
    });
    on('messagePeer', (message) => {
      const room = member(); if (!room) return;
      const stream = room.streams.get(message.channel);
      const target = [...room.sockets.values()].find(s => s.user === message.target);
      if (!stream || !target || target === socket) return fail('signalDenied');
      const publisher = stream.socketId === socket.id;
      if (!publisher && stream.socketId !== target.id) return fail('signalDenied');
      if (!['offer', 'answer', 'candidate'].includes(message.type)) return fail('signalDenied');
      if ((message.type === 'offer' && !publisher) || (message.type === 'answer' && publisher)) return fail('signalDenied');
      const data = { type: message.type, from: socket.user, target: target.user, channel: stream.channel };
      if (message.type === 'candidate') {
        if (typeof message.candidate?.candidate !== 'string' || message.candidate.candidate.length > 4096) return fail('invalidSignal');
        data.candidate = { candidate: message.candidate.candidate, sdpMid: message.candidate.sdpMid, sdpMLineIndex: message.candidate.sdpMLineIndex };
      } else {
        if (message.content?.type !== message.type || typeof message.content?.sdp !== 'string' || message.content.sdp.length > 100000) return fail('invalidSignal');
        data.content = { type: message.type, sdp: message.content.sdp };
      }
      target.emit('message', data);
    });
    socket.on('disconnect', () => { clearTimeout(expiry); leave(socket); sessions.delete(socket); });
  }
  const getStats = () => {
    const result = {};
    for (const socket of sessions) {
      result[socket.account] ||= { connections: 0, bitrate: 0, audioBitrate: 0, broadcasters: 0, players: 0 };
      result[socket.account].connections++;
    }
    for (const room of rooms.values()) for (const stream of room.streams.values()) {
      const owner = room.sockets.get(stream.socketId); if (!owner) continue;
      const row = result[owner.account], copies = Math.max(0, room.sockets.size - 1);
      row.bitrate += stream.videoBitrate * copies; row.audioBitrate += stream.audioBitrate * copies;
      row.broadcasters++; row.players += copies;
    }
    return result;
  };
  return { setup, rooms, sessions, getStats };
}
module.exports = { createConference, validateClaims };
