import { io } from 'socket.io-client';

const root = document.querySelector('#vwconf-first-call');
const labels = window.vwconfSetupLabels;
if (root && labels) {
  const run = root.querySelector('[data-vwconf-run]');
  const outcomes = {
    signal: root.querySelector('[data-vwconf-signal]'),
    callback: root.querySelector('[data-vwconf-callback]'),
    turn: root.querySelector('[data-vwconf-turn]'),
  };
  const show = (stage, outcome) => { outcomes[stage].textContent = labels[outcome]; };

  async function request(signal, probe = '') {
    const body = new URLSearchParams({ action: 'vwconf_setup_check', nonce: root.dataset.nonce, probe });
    const response = await fetch(root.dataset.ajax, { method: 'POST', body, credentials: 'same-origin', cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok || !result.success) throw Error('Check unavailable');
    return result.data;
  }

  run.addEventListener('click', async () => {
    run.disabled = true;
    for (const stage of Object.keys(outcomes)) show(stage, 'checking');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const deadline = setTimeout(cancel, 23000);
    window.addEventListener('pagehide', cancel, { once: true });
    try {
      const probe = await request(controller.signal);
      const connection = await signalingCheck(probe, controller.signal);
      show('signal', connection.ready ? 'ready' : connection.reached ? 'transport' : 'unreachable');
      try {
        const status = await request(controller.signal, probe.id);
        show('callback', status.verified ? 'verified' : 'callbackFailed');
      } catch {
        show('callback', 'checkFailed');
      }
      show('turn', connection.ready ? await turnCheck(connection.iceServers, controller.signal) : 'skipped');
    } catch {
      show('signal', 'checkFailed');
      show('callback', 'skipped');
      show('turn', 'skipped');
    } finally {
      clearTimeout(deadline);
      window.removeEventListener('pagehide', cancel);
      run.disabled = false;
    }
  });

  root.querySelector('[data-vwconf-copy]')?.addEventListener('click', async () => {
    const invite = root.querySelector('#vwconf-setup-invite');
    const result = root.querySelector('[data-vwconf-copy-result]');
    try {
      await navigator.clipboard.writeText(invite.value);
      result.textContent = labels.copied;
    } catch {
      invite.focus();
      invite.select();
      result.textContent = labels.copyManually;
    }
  });
}

function signalingCheck(probe, signal) {
  return new Promise(resolve => {
    let reached = false;
    const socket = io(probe.socket, {
      auth: probe.auth, transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true, timeout: 8000,
    });
    const finish = (ready = false, iceServers = []) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      socket.io.off('open', opened);
      socket.removeAllListeners();
      socket.disconnect();
      resolve({ reached, ready, iceServers });
    };
    const cancel = () => finish();
    const opened = () => { reached = true; };
    const timer = setTimeout(cancel, 9500);
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    socket.io.on('open', opened);
    socket.on('connect_error', cancel);
    socket.on('disconnect', cancel);
    socket.on('conferenceReady', info => finish(info?.version === 1, info?.peerConfig?.iceServers));
    socket.connect();
  });
}

function turnCheck(entries, signal) {
  const iceServers = [];
  for (const server of Array.isArray(entries) ? entries.slice(0, 12) : []) {
    const urls = (Array.isArray(server?.urls) ? server.urls : [server?.urls])
      .slice(0, 12).filter(url => typeof url === 'string' && /^turns?:/i.test(url));
    if (urls.length) iceServers.push({ urls, username: server.username, credential: server.credential });
  }
  if (!iceServers.length) return 'turnMissing';
  if (!window.RTCPeerConnection || signal.aborted) return 'turnFailed';

  return new Promise(resolve => {
    let peer;
    const finish = result => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      if (peer) {
        peer.onicecandidate = null;
        peer.close();
      }
      resolve(result);
    };
    const cancel = () => finish('turnFailed');
    const timer = setTimeout(cancel, 8000);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      peer = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
      peer.onicecandidate = ({ candidate }) => {
        if (!candidate) cancel();
        else if (candidate.type === 'relay' || /\btyp relay\b/.test(candidate.candidate)) finish('turnOK');
      };
      peer.createDataChannel('relay-allocation');
      peer.createOffer().then(offer => peer.setLocalDescription(offer)).catch(cancel);
    } catch {
      cancel();
    }
  });
}
