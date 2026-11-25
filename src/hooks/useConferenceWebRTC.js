import { useCallback, useEffect, useRef, useState } from 'react';
import useConferenceStore from '../store/useConferenceStore';
import { initializeVideoWhisperConnection, disconnectVideoWhisperConnection } from '../services/videowhisperServer';
import { MeshTransport, stopStream } from '../services/meshTransport';
import { t } from '../config/labels';
import { captureMedia, mediaFailure, connectionSnapshot } from '../services/mediaDevices';

export default function useConferenceWebRTC() {
  const { socket, config } = useConferenceStore();
  const transport = useRef(null), streams = useRef({}), intent = useRef(false), generation = useRef(0), joinedRef = useRef(false);
  const [joined, setJoined] = useState(false), [mediaError, setMediaError] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true), [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const pushToTalkEnabled = useConferenceStore(state => !!state.ui.pushToTalkEnabled);
  const talkSources = useRef(new Set());
  const pendingCameraStreams = useRef(new Set());
  const [devices, setDevices] = useState([]), [selection, setSelection] = useState({ camera: '', microphone: '' });
  const [deviceBusy, setDeviceBusy] = useState(false), [deviceStatus, setDeviceStatus] = useState(null), [diagnostics, setDiagnostics] = useState(null);
  const diagnosticsPrevious = useRef(null), deviceOperation = useRef(false), diagnosticsBusy = useRef(false);
  const setMicrophone = useCallback(enabled => {
    // replaceTrack is asynchronous: gate the pending stream as well as the current one.
    const tracks = [...new Set([streams.current.camera, ...pendingCameraStreams.current]
      .flatMap(stream => stream?.getAudioTracks() || []).filter(track => track.readyState === 'live'))];
    tracks.forEach(track => { track.enabled = enabled; });
    const mic = enabled && tracks.length > 0;
    setMicEnabled(mic);
    const state = useConferenceStore.getState();
    if (state.socket?.connected && joinedRef.current) state.socket.emit('participantUpdate', { room: state.config.channel, patch: { mic } });
  }, []);
  const releaseTalk = useCallback(() => { talkSources.current.clear(); setMicrophone(false); }, [setMicrophone]);
  const startTalking = source => {
    if (!useConferenceStore.getState().ui.pushToTalkEnabled || !joinedRef.current || !intent.current ||
      !useConferenceStore.getState().socket?.connected || deviceOperation.current || document.hidden ||
      !streams.current.camera?.getAudioTracks().some(track => track.readyState === 'live')) return;
    talkSources.current.add(source); setMicrophone(true);
  };
  const stopTalking = useCallback(source => {
    if (!talkSources.current.delete(source)) return;
    if (!talkSources.current.size) setMicrophone(false);
  }, [setMicrophone]);
  const setPushToTalkEnabled = enabled => {
    // Never restore a previously open microphone when changing modes.
    releaseTalk(); useConferenceStore.getState().setUi({ pushToTalkEnabled: !!enabled });
  };
  useEffect(() => {
    const cancel = () => { if (useConferenceStore.getState().ui.pushToTalkEnabled) releaseTalk(); };
    const visibility = () => { if (document.hidden) cancel(); };
    const pointer = event => stopTalking('pointer:' + event.pointerId);
    const keyboard = event => { if ([' ', 'Enter'].includes(event.key)) stopTalking('key:' + event.key); };
    window.addEventListener('blur', cancel); window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerup', pointer); window.addEventListener('pointercancel', pointer); window.addEventListener('keyup', keyboard);
    return () => {
      window.removeEventListener('blur', cancel); window.removeEventListener('pagehide', cancel);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pointerup', pointer); window.removeEventListener('pointercancel', pointer); window.removeEventListener('keyup', keyboard);
    };
  }, [releaseTalk, stopTalking]);
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter(device => ['audioinput', 'videoinput'].includes(device.kind)).slice(0, 100)); } catch { setDeviceStatus(t('The device list could not be read. Check browser permissions.')); }
  }, []);
  useEffect(() => {
    refreshDevices(); const media = navigator.mediaDevices;
    media?.addEventListener?.('devicechange', refreshDevices);
    return () => media?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);
  const refreshDiagnostics = useCallback(async () => {
    if (diagnosticsBusy.current) return;
    diagnosticsBusy.current = true; const epoch = generation.current;
    const mesh = transport.current;
    const next = await connectionSnapshot(mesh ? [...mesh.outgoing.values(), ...mesh.incoming.values()] : [], diagnosticsPrevious.current);
    diagnosticsBusy.current = false;
    if (epoch !== generation.current) return;
    diagnosticsPrevious.current = next; setDiagnostics(next);
  }, []);
  const checkDevices = async () => {
    if (deviceOperation.current) return;
    deviceOperation.current = true; setDeviceBusy(true); let stream;
    try { stream = await captureMedia(config?.stream, selection); await refreshDevices(); setDeviceStatus(t('Selected devices are available. No connection was started.')); }
    catch (error) { setDeviceStatus(mediaFailure(error)); }
    finally { stopStream(stream); deviceOperation.current = false; setDeviceBusy(false); }
  };
  const applyDevices = async () => {
    if (deviceOperation.current || !joinedRef.current) return;
    if (useConferenceStore.getState().ui.pushToTalkEnabled) releaseTalk();
    deviceOperation.current = true; setDeviceBusy(true); const epoch = generation.current; let stream;
    try {
      stream = await captureMedia(config?.stream, selection);
      if (epoch !== generation.current || !joinedRef.current) { stopStream(stream); return; }
      pendingCameraStreams.current.add(stream);
      const old = streams.current.camera;
      stream.getAudioTracks().forEach(track => { track.enabled = !useConferenceStore.getState().ui.pushToTalkEnabled && (old?.getAudioTracks().length ? old.getAudioTracks().some(track => track.enabled) : true); });
      stream.getVideoTracks().forEach(track => { track.enabled = old?.getVideoTracks().length ? old.getVideoTracks().some(track => track.enabled) : true; });
      await transport.current?.replaceStream('camera', stream);
      if (epoch !== generation.current || !joinedRef.current) { stopStream(stream); return; }
      if (stream.getTracks().length) { streams.current.camera = stream; useConferenceStore.getState().setLocalStream('camera', stream); }
      else { delete streams.current.camera; useConferenceStore.getState().removeLocalStream('camera'); }
      const mic = stream.getAudioTracks().some(track => track.enabled), camera = stream.getVideoTracks().some(track => track.enabled);
      setMicEnabled(mic); setCameraEnabled(camera); emit('participantUpdate', { patch: { mic, camera } });
      stopStream(old); await refreshDevices(); setMediaError(null); setDeviceStatus(t('Selected devices are now in use.'));
    } catch (error) { stopStream(stream); setDeviceStatus(mediaFailure(error)); }
    finally { pendingCameraStreams.current.delete(stream); deviceOperation.current = false; setDeviceBusy(false); }
  };

  const emit = useCallback((event, data) => {
    const state = useConferenceStore.getState();
    if (state.socket?.connected) state.socket.emit(event, { room: state.config.channel, ...data });
  }, []);
  const cleanup = useCallback(() => {
    talkSources.current.clear();
    generation.current++; intent.current = false; joinedRef.current = false;
    diagnosticsPrevious.current = null; setDiagnostics(null); setDeviceStatus(null);
    transport.current?.reset(); transport.current?.local.clear();
    [...Object.values(streams.current), ...pendingCameraStreams.current].forEach(stopStream); streams.current = {}; pendingCameraStreams.current.clear();
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
      if (store().ui.pushToTalkEnabled) releaseTalk();
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
        releaseTalk();
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
  }, [socket, emit, leaveRoom, cleanup, releaseTalk]);
  useEffect(() => () => { cleanup(); disconnectVideoWhisperConnection(); }, [cleanup]);
  const joinRoom = async (displayName, withMedia = true) => {
    if (deviceOperation.current || intent.current) return;
    deviceOperation.current = true; setDeviceBusy(true);
    const epoch = generation.current; setMediaError(null);
    try {
      if (withMedia) {
        const stream = await captureMedia(config.stream, selection);
        if (generation.current !== epoch) { stopStream(stream); return; }
        stream.getAudioTracks().forEach(track => { track.enabled = !useConferenceStore.getState().ui.pushToTalkEnabled && config.conference?.startMicMuted !== true; });
        stream.getVideoTracks().forEach(track => { track.enabled = config.conference?.startCameraOff !== true; });
        if (stream.getTracks().length) { streams.current.camera = stream; useConferenceStore.getState().setLocalStream('camera', stream); }
      }
      setMicEnabled(!!streams.current.camera?.getAudioTracks().some(track => track.enabled)); setCameraEnabled(!!streams.current.camera?.getVideoTracks().some(track => track.enabled));
      const state = useConferenceStore.getState();
      state.setConfig({ ...state.config, displayName: displayName.trim().slice(0, 80) || state.config.username });
      intent.current = true; state.setNotice(t('Joining meeting…'));
      initializeVideoWhisperConnection(useConferenceStore.getState().config);
    } catch (error) { setMediaError(mediaFailure(error)); }
    finally { deviceOperation.current = false; setDeviceBusy(false); }
  };
  const toggleMic = () => { if (useConferenceStore.getState().ui.pushToTalkEnabled || !streams.current.camera?.getAudioTracks().length) return; setMicrophone(!streams.current.camera.getAudioTracks().some(track => track.enabled)); };
  const toggleCamera = () => { if (!streams.current.camera?.getVideoTracks().length) return; const next = !cameraEnabled; setCameraEnabled(next); streams.current.camera.getVideoTracks().forEach(track => { track.enabled = next } ); emit('participantUpdate', { patch: { camera: next } }); };
  const stopScreenShare = () => {
    transport.current?.unpublish('screen'); stopStream(streams.current.screen); delete streams.current.screen;
    useConferenceStore.getState().removeLocalStream('screen'); setScreenSharing(false); emit('participantUpdate', { patch: { screen: false } });
  };
  const startScreenShare = async () => {
    const epoch = generation.current;
    try {
      const p = config.stream || {};
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { max: p.width || 640 }, height: { max: p.height || 360 }, frameRate: { max: p.frameRate ?? p.framerate ?? 15 } }, audio: false });
      if (epoch !== generation.current || !intent.current) { stopStream(stream); return; }
      streams.current.screen = stream; useConferenceStore.getState().setLocalStream('screen', stream);
      stream.getVideoTracks()[0].onended = stopScreenShare; transport.current?.publish('screen', stream);
      setScreenSharing(true); emit('participantUpdate', { patch: { screen: true } });
    } catch { setMediaError(t('Screen sharing was cancelled or unavailable.')); }
  };
  return { pushToTalkEnabled, setPushToTalkEnabled, startTalking, stopTalking, releaseTalk, devices, selection, setSelection, deviceBusy, deviceStatus, checkDevices, applyDevices, refreshDevices, diagnostics, refreshDiagnostics, joined, mediaError, micEnabled, cameraEnabled, screenSharing, joinRoom, leaveRoom, toggleMic, toggleCamera,
    startScreenShare, stopScreenShare, sendRoomMessage: body => emit('roomMessage', { message: { body, kind: 'msg' } }),
    sendRoomAction: (action, target) => emit('roomAction', { action, target }) };
}
