import { create } from 'zustand';

const initialRoomState = {
  participants: {},
  streams: {},
  messages: [],
  meta: {},
};

const useConferenceStore = create((set, get) => ({
  config: null,
  configLoaded: false,
  currentView: 'Loading',
  error: null,
  notice: null,

  socket: null,
  socketConnected: false,
  socketConnecting: false,
  peerConfig: { iceServers: [] },

  room: initialRoomState,
  localStreams: {},
  remoteStreams: {},
  ui: {
    layout: 'gallery',
    chatOpen: true,
    peopleOpen: false,
    inviteOpen: false,
    pinnedStreamId: null,
    spotlightedUser: null,
  },

  setNotice: (notice) => set({ notice }),
  resetRemote: () => set({ remoteStreams: {}, room: initialRoomState }),
  setConfig: (config) => set({
    config,
    configLoaded: true,
    currentView: config.deny ? 'Denied' : (get().configLoaded ? get().currentView : 'Lobby'),
    error: config.deny || null,
  }),
  setError: (error) => set({ error: typeof error === 'string' ? error : error?.message || 'Unknown error', currentView: 'Error' }),
  setView: (currentView) => set({ currentView }),

  setSocket: (socket) => set({ socket }),
  setSocketConnected: (socketConnected) => set({ socketConnected, socketConnecting: socketConnected ? false : get().socketConnecting }),
  setSocketConnecting: (socketConnecting) => set({ socketConnecting }),
  setPeerConfig: (peerConfig) => set({ peerConfig }),

  resetRoom: () => set({ room: initialRoomState, remoteStreams: {}, localStreams: {} }),
  applyRoomUpdate: (update) => set((state) => {
    const room = { ...state.room };

    if (update.participants) room.participants = update.participants;
    if (update.streams) room.streams = update.streams;
    if (update.messages) room.messages = update.messages;
    if (update.meta) room.meta = { ...room.meta, ...update.meta };
    if (update.participantUpdate?.id) {
      room.participants = {
        ...room.participants,
        [update.participantUpdate.id]: update.participantUpdate.participant,
      };
    }
    if (update.participantJoin?.id) {
      room.participants = {
        ...room.participants,
        [update.participantJoin.id]: update.participantJoin,
      };
    }
    if (update.participantLeft?.id) {
      room.participants = { ...room.participants };
      delete room.participants[update.participantLeft.id];
    }
    if (update.streamNew?.streamId) {
      room.streams = {
        ...room.streams,
        [update.streamNew.streamId]: update.streamNew,
      };
    }
    if (update.streamRemove) {
      room.streams = { ...room.streams };
      delete room.streams[update.streamRemove];
    }
    if (update.messageNew) {
      room.messages = [...room.messages, update.messageNew].slice(-100);
    }
    if (update.roomAction?.action === 'spotlight') {
      room.meta = { ...room.meta, spotlighted: update.roomAction.target || null };
    }

    return { room };
  }),

  setLocalStream: (kind, stream) => set((state) => ({
    localStreams: {
      ...state.localStreams,
      [kind]: stream,
    },
  })),
  removeLocalStream: (kind) => set((state) => {
    const next = { ...state.localStreams };
    delete next[kind];
    return { localStreams: next };
  }),
  setRemoteStream: (streamId, data) => set((state) => ({
    remoteStreams: {
      ...state.remoteStreams,
      [streamId]: {
        ...(state.remoteStreams[streamId] || {}),
        ...data,
        streamId,
      },
    },
  })),
  removeRemoteStream: (streamId) => set((state) => {
    const next = { ...state.remoteStreams };
    delete next[streamId];
    return { remoteStreams: next };
  }),
  setUi: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),
}));

export default useConferenceStore;
