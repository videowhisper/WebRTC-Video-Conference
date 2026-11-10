import { t } from "../config/labels";
import { useEffect, useMemo, useState } from 'react';
import { Clock, Lock, Users, Share2 } from 'lucide-react';
import useConferenceStore from '../store/useConferenceStore';
import VideoTile from './VideoTile';
import Controls from './Controls';
import InvitePanel from './InvitePanel';
import ThemeToggle from './ThemeToggle';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
function elapsedLabel(startedAt, now) {
  const elapsed = Math.max(0, now - (startedAt || now));
  const minutes = Math.floor(elapsed / 60000);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export default function Meeting({
  conference
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const {
    config,
    room,
    remoteStreams,
    localStreams,
    ui,
    setUi,
    notice
  } = useConferenceStore();
  const participants = Object.values(room.participants || {});
  const remoteTiles = Object.entries(remoteStreams || {}).map(([id, media]) => {
    const info = room.streams[id] || {};
    const participant = participants.find(p => p.name === (info.user || media.user));
    return {
      ...info,
      ...media,
      displayName: participant?.displayName,
      mutedAudio: participant?.mic === false,
      hand: participant?.hand,
      mutedVideo: participant?.camera === false
    };
  });
  const tiles = useMemo(() => {
    const local = localStreams.camera ? [{
      streamId: 'local:camera',
      user: config?.username,
      displayName: config?.displayName || config?.username,
      mutedAudio: !conference.micEnabled,
      mutedVideo: !conference.cameraEnabled,
      kind: 'camera',
      mediaStream: localStreams.camera,
      local: true,
      hand: participants.find(p => p.name === config?.username)?.hand
    }] : [];
    const screen = localStreams.screen ? [{
      streamId: 'local:screen',
      user: config?.username,
      displayName: t("Your screen"),
      kind: 'screen',
      mediaStream: localStreams.screen,
      local: true
    }] : [];
    const mediaTiles = [...screen, ...local, ...remoteTiles];
    const avatars = participants.filter(p => !mediaTiles.some(tile => tile.user === p.name && tile.kind !== 'screen')).map(p => ({
      streamId: `participant:${p.id}`, user: p.name, displayName: p.displayName, kind: 'avatar', mutedAudio: p.mic === false, hand: p.hand,
    }));
    return [...mediaTiles, ...avatars];
  }, [config?.displayName, config?.username, localStreams.camera, localStreams.screen, remoteTiles, conference.micEnabled, conference.cameraEnabled, participants]);
  const activeTiles = tiles.length ? tiles : participants.map(participant => ({
    streamId: `participant:${participant.id}`,
    user: participant.name,
    displayName: participant.displayName || participant.name,
    kind: 'avatar'
  }));
  const spotlightUser = room.meta?.spotlighted;
  const spotlightTile = activeTiles.find(tile => tile.streamId === ui.pinnedStreamId) || activeTiles.find(tile => tile.user === spotlightUser) || activeTiles.find(tile => tile.kind === 'screen') || activeTiles[0];
  const galleryTiles = spotlightTile ? activeTiles.filter(tile => tile.streamId !== spotlightTile.streamId) : activeTiles;
  return <main className="vwc-app vwc-meeting flex flex-col vwc-background vwc-text">
      <header className="vwc-meeting-header flex shrink-0 items-center justify-between border-b vwc-border vwc-surface px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-300 text-xs font-black text-zinc-950">vw</div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{config?.title || config?.channel}</h1>
            <div className="mt-0.5 flex items-center gap-3 text-xs vwc-secondary">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsedLabel(room.meta?.createdAt, now)}</span>
              {room.meta?.locked && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />{t("locked")}</span>}
            </div>
          </div>
        </div>

        <div className="vwc-header-actions flex items-center gap-2">
          <ThemeToggle />
          <button type="button" className="vwc-invite-button" onClick={() => setUi({ inviteOpen: !ui.inviteOpen, chatOpen: false, peopleOpen: false })}><Share2 size={16} />{t("Invite")}</button>
          <button type="button" onClick={() => setUi({
          layout: ui.layout === 'speaker' ? 'gallery' : 'speaker'
        })} className="rounded-md border vwc-border vwc-muted-surface px-3 py-1.5 text-xs vwc-text transition hover:bg-white/10">
            {ui.layout === 'speaker' ? t("Gallery") : t("Speaker")}
          </button>
          <button type="button" onClick={() => setUi({
          peopleOpen: !ui.peopleOpen, chatOpen: false, inviteOpen: false
        })} className="inline-flex items-center gap-2 rounded-md border vwc-border vwc-muted-surface px-3 py-1.5 text-xs vwc-text transition hover:bg-white/10">
            <Users className="h-4 w-4" />
            {participants.length}
          </button>
        </div>
      </header>

      {notice && <p role="status" className="bg-amber-950 p-2 text-center">{notice}</p>}
      {conference.mediaError && <p role="alert" className="bg-red-950 p-2 text-center">{conference.mediaError}</p>}
      <section className="vwc-workspace">
        <div className="vwc-stage">
          <div className="vwc-media-grid min-h-0 flex-1 p-3">
            {ui.layout === 'speaker' && spotlightTile ? <div className={`grid h-full gap-3 ${galleryTiles.length ? "grid-rows-[minmax(0,1fr)_5rem]" : "grid-rows-1"}`}>
                <VideoTile tile={spotlightTile} large onPin={() => setUi({
              pinnedStreamId: spotlightTile.streamId
            })} />
                <div className="flex gap-3 overflow-x-auto">
                  {galleryTiles.map(tile => <VideoTile key={tile.streamId} tile={tile} compact onPin={() => setUi({
                pinnedStreamId: tile.streamId
              })} />)}
                </div>
              </div> : <div className={`grid h-full auto-rows-fr gap-3 ${activeTiles.length > 4 ? 'sm:grid-cols-2 xl:grid-cols-3' : activeTiles.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                {activeTiles.map(tile => <VideoTile key={tile.streamId} tile={tile} onPin={() => setUi({
              pinnedStreamId: tile.streamId
            })} />)}
              </div>}
          </div>

          <Controls conference={conference} />
        </div>

        {ui.inviteOpen && <InvitePanel />}
        {ui.chatOpen && !ui.inviteOpen && <ChatPanel conference={conference} />}
        {ui.peopleOpen && !ui.chatOpen && !ui.inviteOpen && <ParticipantsPanel conference={conference} />}
      </section>
    </main>;
}
