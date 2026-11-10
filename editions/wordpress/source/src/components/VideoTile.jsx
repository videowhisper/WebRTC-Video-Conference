import { t } from "../config/labels";
import { useEffect, useMemo, useRef } from 'react';
import { Hand, MicOff, Pin, ScreenShare, VideoOff, Wifi } from 'lucide-react';
function initials(name = t("Guest")) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'VW';
}
function avatarClass(seed = '') {
  const palettes = ['from-cyan-300 to-blue-500', 'from-emerald-300 to-teal-600', 'from-amber-300 to-rose-500', 'from-fuchsia-300 to-indigo-500', 'from-lime-300 to-emerald-600', 'from-sky-300 to-violet-500'];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = hash * 31 + seed.charCodeAt(index) >>> 0;
  return palettes[hash % palettes.length];
}
export default function VideoTile({
  tile,
  large = false,
  compact = false,
  onPin
}) {
  const videoRef = useRef(null);
  const name = tile.displayName || tile.user || t("Participant");
  const avatar = useMemo(() => avatarClass(name), [name]);
  useEffect(() => {
    if (videoRef.current && tile.mediaStream) {
      videoRef.current.srcObject = tile.mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [tile.mediaStream]);
  return <article className={`vwc-tile group relative min-h-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-xl ${compact ? 'vwc-compact-tile h-full' : ''}`}>
      {tile.mediaStream ? <video ref={videoRef} autoPlay playsInline muted={tile.local} className={`h-full w-full ${tile.kind === 'screen' ? 'object-contain' : 'object-cover'} ${tile.mutedVideo ? 'opacity-0' : ''}`} /> : <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${avatar}`}>
          <div className={`${large ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-xl'} flex items-center justify-center rounded-full bg-black/30 font-semibold text-white shadow-2xl`}>
            {initials(name)}
          </div>
        </div>}

      {tile.hand && <div className="vwc-hand-badge" role="status"><Hand size={16} />{t('Hand raised')}</div>}
      {tile.kind === 'screen' && <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
          <ScreenShare className="h-3.5 w-3.5" />{t("Screen")}</div>}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            {tile.mutedAudio && <MicOff className="h-3.5 w-3.5 text-red-300" />}
            {tile.mutedVideo && <VideoOff className="h-3.5 w-3.5 text-red-300" />}
          </div>
          {tile.connectionState && <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-300">
              <Wifi className="h-3 w-3" />
              {tile.connectionState}
            </span>}
        </div>

        {!compact && <button type="button" onClick={onPin} className="rounded-full bg-black/45 p-2 opacity-0 transition hover:bg-black/65 group-hover:opacity-100" title={t("Pin")}>
            <Pin className="h-4 w-4" />
          </button>}
      </div>
    </article>;
}
