import { useCallback, useEffect, useRef, useState } from 'react';
import useConferenceStore from '../store/useConferenceStore';
import { initializeVideoWhisperConnection, disconnectVideoWhisperConnection } from '../services/videowhisperServer';
import { MeshTransport, stopStream } from '../services/meshTransport';
import { t } from '../config/labels';

export default function useConferenceWebRTC() {
  const { socket, config } = useConferenceStore();
  const transport = useRef(null), streams = useRef({}), intent = useRef(false), generation = useRef(0), joinedRef = useRef(false);
  const [joined, setJoined] = useState(false), [mediaError, setMediaError] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true), [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const emit = useCallback((event, data) => {
    const state = useConferenceStore.getState();
    if (state.socket?.connected) state.socket.emit(event, { room: state.config.channel, ...data });
  }, []);
  const cleanup = useCallback(() => {
    generation.current++; intent.current = false; joinedRef.current = false;
    transport.current?.reset(); transport.current?.local.clear();
    Object.values(streams.current).forEach(stopStream); streams.current = {};
    setJoined(false); setScreenSharing(false); setMicEnabled(true); setCameraEnabled(true);
    useConferenceStore.getState().resetRoom();
  }, []);
  const leaveRoom = useCallback(() => { emit('roomLeave', {}); cleanup(); disconnectVideoWhisperConnection(); }, [cleanup, emit]);
  useEffect(() => {
    if (!socket) return;
    const store = useConferenceStore.getState, cfg = store().config;
    const mesh = new MeshTransport({ socket, config: cfg, getPeerConfig: () => store().peerConfig,
      onRemote: (id, data) => store().setRemoteStream(id, data), onRemove: id => store().removeRemoteStream(id) });
    transport.current = mesh;
    let ready = false;
    const onReady = info => {
      if (info.version !== 1) { leaveRoom(); store().setError(t('This server needs the conference extension.')); return; }
      ready = true; store().setPeerConfig(info.peerConfig);
      if (intent.current) emit('roomJoin', { options: { participant: { displayName: store().config.displayName } } });
    };
    const onDisconnect = () => {
      ready = false; mesh.reset(); joinedRef.current = false; setJoined(false); store().resetRemote();
      if (intent.current) store().setNotice(t('Reconnecting to the meeting…'));
    };
    const onSignal = message => mesh.signal(message).catch(() => setMediaError(t('Media connection failed. Leave and rejoin to retry.')));
    const onUpdate = update => {
      if (update.room !== cfg.channel) return;
      if (update.code || update.error) {
        const terminal = ['removedFromRoom', 'sessionExpired', 'roomFull', 'roomLocked', 'roomDenied', 'duplicateUser'].includes(update.code);
        const text = t(update.code || 'Meeting request failed.');
        if (terminal || !joinedRef.current) { leaveRoom(); store().setError(text); }
        else setMediaError(text);
        return;
      }
      if (update.type === 'muteRequested') {
        streams.current.camera?.getAudioTracks().forEach(track => { track.enabled = false; });
        setMicEnabled(false); emit('participantUpdate', { patch: { mic: false } });
      }
      store().applyRoomUpdate(update);
      if (update.type === 'roomJoin' || update.type === 'roomState') {
        joinedRef.current = true; setJoined(true); store().setNotice(null); store().setView('Meeting');
        emit('participantUpdate', { patch: {
          mic: streams.current.camera?.getAudioTracks().some(track => track.enabled && track.readyState === 'live') || false,
          camera: streams.current.camera?.getVideoTracks().some(track => track.enabled && track.readyState === 'live') || false,
        } });
        Object.entries(streams.current).forEach(([kind, stream]) => mesh.publish(kind, stream));
      }
      if (update.streamRemove) mesh.remove(update.streamRemove);
      if (update.participantLeft) mesh.removeUser(update.participantLeft.name);
    };
    const onConnectError = () => { cleanup(); disconnectVideoWhisperConnection(); };
    socket.on('connect_error', onConnectError);
    socket.on('conferenceReady', onReady); socket.on('roomUpdate', onUpdate); socket.on('message', onSignal); socket.on('disconnect', onDisconnect);
    const timeout = setInterval(() => { if (!ready && intent.current && socket.connected) { leaveRoom(); store().setError(t('This server needs the conference extension.')); } }, 12000);
    return () => {
      clearInterval(timeout); mesh.reset();
      socket.off('connect_error', onConnectError);
      socket.off('conferenceReady', onReady); socket.off('roomUpdate', onUpdate); socket.off('message', onSignal); socket.off('disconnect', onDisconnect);
    };
  }, [socket, emit, leaveRoom, cleanup]);
  useEffect(() => () => { cleanup(); disconnectVideoWhisperConnection(); }, [cleanup]);
  const joinRoom = async (displayName, withMedia = true) => {
    const epoch = generation.current; setMediaError(null);
    try {
      if (withMedia) {
        const p = config.stream || {};
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: {
          width: { ideal: p.width || 640, max: p.width || 640 }, height: { ideal: p.height || 360, max: p.height || 360 },
          frameRate: { ideal: p.framerate || 15, max: p.framerate || 15 },
        } });
        if (generation.current !== epoch) { stopStream(stream); return; }
        streams.current.camera = stream; useConferenceStore.getState().setLocalStream('camera', stream);
      }
      setMicEnabled(withMedia); setCameraEnabled(withMedia);
      const state = useConferenceStore.getState();
      state.setConfig({ ...state.config, displayName: displayName.trim().slice(0, 80) || state.config.username });
      intent.current = true; state.setNotice(t('Joining meeting…'));
      initializeVideoWhisperConnection(useConferenceStore.getState().config);
    } catch { setMediaError(t('Camera or microphone unavailable. Allow browser access or join without media.')); }
  };
  const toggleMic = () => { if (!streams.current.camera?.getAudioTracks().length) return; const next = !micEnabled; setMicEnabled(next); streams.current.camera.getAudioTracks().forEach(track => { track.enabled = next; }); emit('participantUpdate', { patch: { mic: next } }); };
  const toggleCamera = () => { if (!streams.current.camera?.getVideoTracks().length) return; const next = !cameraEnabled; setCameraEnabled(next); streams.current.camera.getVideoTracks().forEach(track => { track.enabled = next } ); emit('participantUpdate', { patch: { camera: next } }); };
  const stopScreenShare = () => {
    transport.current?.unpublish('screen'); stopStream(streams.current.screen); delete streams.current.screen;
    useConferenceStore.getState().removeLocalStream('screen'); setScreenSharing(false); emit('participantUpdate', { patch: { screen: false } });
  };
  const startScreenShare = async () => {
    const epoch = generation.current;
    try {
      const p = config.stream || {};
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { max: p.width || 640 }, height: { max: p.height || 360 }, frameRate: { max: p.framerate || 15 } }, audio: false });
      if (epoch !== generation.current || !intent.current) { stopStream(stream); return; }
      streams.current.screen = stream; useConferenceStore.getState().setLocalStream('screen', stream);
      stream.getVideoTracks()[0].onended = stopScreenShare; transport.current?.publish('screen', stream);
      setScreenSharing(true); emit('participantUpdate', { patch: { screen: true } });
    } catch { setMediaError(t('Screen sharing was cancelled or unavailable.')); }
  };
  return { joined, mediaError, micEnabled, cameraEnabled, screenSharing, joinRoom, leaveRoom, toggleMic, toggleCamera,
    startScreenShare, stopScreenShare, sendRoomMessage: body => emit('roomMessage', { message: { body, kind: 'msg' } }),
    sendRoomAction: (action, target) => emit('roomAction', { action, target }) };
}
