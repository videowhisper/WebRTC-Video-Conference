import { t } from '../config/labels';
import { io } from 'socket.io-client';
import useConferenceStore from '../store/useConferenceStore';

let socket = null;

function authFromConfig(config) {
  const server = config?.videowhisperServer || {};

  if (server.authentication === 'pin' && server.account && server.pin) {
    return {
      account: server.account,
      pin: server.pin,
      user: server.user || config.username,
    };
  }

  return null;
}

export function initializeVideoWhisperConnection(config) {
  const store = useConferenceStore.getState();
  const server = config?.videowhisperServer || {};
  const auth = authFromConfig(config);

  if (!server.socket) {
    store.setError('Missing videowhisperServer.socket in conference config.');
    return null;
  }

  if (!auth) {
    store.setError('Missing VideoWhisper authentication details. Conference rooms require account/user/PIN authentication.');
    return null;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(server.socket, {
    auth,
    transports: ['websocket'],
    secure: server.socket.startsWith('https:'),
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    store.setSocketConnected(true);
    store.setSocketConnecting(false);
  });

  socket.on('disconnect', (reason) => {
    store.setSocketConnected(false);
    if (reason === 'io server disconnect') store.setError(t('Session ended. Reload the page to rejoin.'));
  });

  socket.on('connect_error', () => {
    store.setSocketConnected(false);
    store.setSocketConnecting(false);
    store.setError(t('Connection failed. Check your server settings or reload to retry.'));
  });

  store.setSocket(socket);
  store.setSocketConnecting(true);
  socket.connect();

  return socket;
}

export function disconnectVideoWhisperConnection() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  useConferenceStore.getState().setSocket(null);
  useConferenceStore.getState().setSocketConnected(false);
  useConferenceStore.getState().setSocketConnecting(false);
}
