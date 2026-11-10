import { t } from "../config/labels";
import { useState } from 'react';
import { Loader, LogIn } from 'lucide-react';
import InvitePanel from './InvitePanel';
import ThemeToggle from './ThemeToggle';
import useConferenceStore from '../store/useConferenceStore';
export default function Lobby({
  conference
}) {
  const {
    config,
    socketConnecting,
    notice
  } = useConferenceStore();
  const [displayName, setDisplayName] = useState(config?.displayName || config?.username || '');
  const [starting, setStarting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [withMedia, setWithMedia] = useState(true);
  const start = async () => {
    setStarting(true);
    try {
      await conference.joinRoom(displayName, withMedia);
    } finally {
      setStarting(false);
    }
  };
  return <main className="vwc-app vwc-lobby vwc-background vwc-text">
        <section className="vwc-lobby-card vwc-surface">
          <header className="vwc-lobby-heading">
            <div className="min-w-0">
            <h1 className="text-3xl font-semibold">{config?.title || config?.channel || t("Video meeting")}</h1>
            <p className="mt-2 text-sm leading-6 vwc-secondary">{config?.roomAccess === "members" ? t("Sign-in required") : config?.roomAccess === "private" ? t("Private room · invitation required") : t("Public room")}</p>
            </div>
            <ThemeToggle />
          </header>

          <form className="vwc-lobby-form" onSubmit={event => { event.preventDefault(); if (consent && !starting && !socketConnecting) start(); }}>
          <label className="text-sm font-medium vwc-secondary" htmlFor="displayName">{t("Display name")}</label>
          <input id="displayName" name="displayName" autoComplete="nickname" maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} className="vwc-name-input vwc-muted-surface vwc-text" />

          {conference.mediaError && <div role="alert" className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-100">
              {conference.mediaError}
            </div>}

          <label className="vwc-lobby-option text-sm"><input type="checkbox" checked={withMedia} onChange={e => setWithMedia(e.target.checked)} />{t("Use camera and microphone")}</label>
          <label className="vwc-lobby-option text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t("I agree to connect to the configured signaling service and share media with participants when enabled.")}</label>
          {notice && <p role="status" className="vwc-lobby-notice text-sm">{notice}</p>}
          <button type="submit" disabled={starting || socketConnecting || !consent} className="vwc-lobby-join inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
            {starting ? <Loader className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}{t("Join meeting")}</button>

          </form>
          <InvitePanel inline />
        </section>
    </main>;
}
