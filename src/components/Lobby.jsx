import { t } from "../config/labels";
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader, LogIn, Mic, Wifi, WifiOff } from 'lucide-react';
import InvitePanel from './InvitePanel';
import ThemeToggle from './ThemeToggle';
import useConferenceStore from '../store/useConferenceStore';
export default function Lobby({
  conference
}) {
  const {
    config,
    socketConnected,
    socketConnecting,
    notice
  } = useConferenceStore();
  const cameraStream = useConferenceStore(state => state.localStreams.camera);
  const previewRef = useRef(null);
  const [displayName, setDisplayName] = useState(config?.displayName || config?.username || '');
  const [starting, setStarting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [withMedia, setWithMedia] = useState(true);
  useEffect(() => {
    if (previewRef.current && cameraStream) previewRef.current.srcObject = cameraStream;
  }, [cameraStream]);
  const start = async () => {
    setStarting(true);
    try {
      await conference.joinRoom(displayName, withMedia);
    } finally {
      setStarting(false);
    }
  };
  const connectionLabel = socketConnected ? t("Connected") : socketConnecting ? t("Connecting") : t("Offline");
  return <main className="vwc-app vwc-lobby min-h-screen vwc-background vwc-text">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="vwc-preview flex min-h-[60vh] items-center justify-center vwc-surface p-5">
          <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-lg border vwc-border vwc-surface shadow-2xl">
            <video ref={previewRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {!cameraStream && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 vwc-secondary">
                <Camera className="h-10 w-10" />
                <span className="text-sm">{t("Camera preview starts when you join.")}</span>
              </div>}
          </div>
        </section>

        <aside className="flex flex-col justify-center border-l vwc-border vwc-surface p-6">
          <div className="mb-8">
            <div className="flex justify-end"><ThemeToggle /></div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border vwc-border px-3 py-1 text-xs vwc-secondary">
              {socketConnected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-300" />}
              {connectionLabel}
            </div>
            <h1 className="text-3xl font-semibold">{config?.title || config?.channel || t("Video meeting")}</h1>
            <p className="mt-2 text-sm leading-6 vwc-secondary">{config?.roomAccess === "members" ? t("Sign-in required") : config?.roomAccess === "private" ? t("Private room · invitation required") : t("Public room")}</p>
          </div>

          <InvitePanel inline />
          <label className="mb-2 text-sm font-medium vwc-secondary" htmlFor="displayName">{t("Display name")}</label>
          <input id="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} className="mb-5 rounded-md border vwc-border vwc-muted-surface px-3 py-2 text-white outline-none transition focus:border-cyan-300" />

          {conference.mediaError && <div className="mb-4 rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-100">
              {conference.mediaError}
            </div>}

          <label className="mb-4 flex gap-2 text-sm"><input type="checkbox" checked={withMedia} onChange={e => setWithMedia(e.target.checked)} />{t("Use camera and microphone")}</label>
          <label className="mb-4 flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t("I agree to connect to the configured signaling service and share media with participants when enabled.")}</label>
          {notice && <p role="status" className="mb-4 text-sm text-cyan-200">{notice}</p>}
          <button type="button" onClick={start} disabled={starting || socketConnecting || !consent} className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:vwc-secondary">
            {starting ? <Loader className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}{t("Join meeting")}</button>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs vwc-secondary">
            <div className="rounded-md border vwc-border vwc-muted-surface p-3">
              <Mic className="mb-2 h-4 w-4 vwc-secondary" />{t("Browser permission required")}</div>
            <div className="rounded-md border vwc-border vwc-muted-surface p-3">
              <Camera className="mb-2 h-4 w-4 vwc-secondary" />{t("Small group mesh (up to four participants)")}</div>
          </div>
        </aside>
      </div>
    </main>;
}
