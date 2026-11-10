import { t } from "../config/labels";
import { MicOff, Shield, Star, UserMinus, X } from 'lucide-react';
import useConferenceStore from '../store/useConferenceStore';
export default function ParticipantsPanel({
  conference
}) {
  const {
    room,
    ui,
    setUi,
    socket
  } = useConferenceStore();
  const participants = Object.values(room.participants || {});
  const me = participants.find(participant => participant.id === socket?.id);
  const canModerate = me?.permissions?.canModerate || me?.role === 'host' || me?.role === 'cohost';
  return <aside className="vwc-panel flex flex-col vwc-border vwc-surface">
      <header className="flex h-12 items-center justify-between border-b vwc-border px-4">
        <h2 className="text-sm font-semibold">{t("People")}</h2>
        <button type="button" aria-label={t("Close people")} onClick={() => setUi({
        peopleOpen: !ui.peopleOpen
      })} className="rounded-md p-1 vwc-secondary hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {participants.map(participant => <div key={participant.id || participant.name} className="mb-2 rounded-md border vwc-border vwc-muted-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{participant.displayName || participant.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs vwc-secondary">
                  <span>{participant.role === 'host' ? t("Host") : t("Guest")}</span>
                  {(participant.role === 'host' || participant.role === 'cohost') && <Shield className="h-3 w-3 text-cyan-300" />}
                  {participant.hand && <span className="text-amber-300">{t("hand raised")}</span>}
                </div>
              </div>

              {canModerate && participant.id !== socket?.id && <div className="flex gap-1">
                  <button type="button" title={t("Request mute")} onClick={() => conference.sendRoomAction('requestMute', participant.id)} className="rounded-md p-2 vwc-secondary hover:bg-white/10">
                    <MicOff className="h-4 w-4" />
                  </button>
                  <button type="button" title={t("Spotlight")} onClick={() => conference.sendRoomAction('spotlight', participant.name)} className="rounded-md p-2 vwc-secondary hover:bg-white/10">
                    <Star className="h-4 w-4" />
                  </button>
                  <button type="button" title={t("Remove")} onClick={() => conference.sendRoomAction('removeParticipant', participant.id)} className="rounded-md p-2 text-red-300 hover:bg-red-500/20">
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>}
            </div>
          </div>)}
      </div>

      {canModerate && <div className="border-t vwc-border p-3">
          <button type="button" onClick={() => conference.sendRoomAction(room.meta?.locked ? 'unlockRoom' : 'lockRoom')} className="mb-2 w-full rounded-md border vwc-border px-3 py-2 text-sm">{room.meta?.locked ? t('Unlock meeting') : t('Lock meeting')}</button>
          <button type="button" onClick={() => conference.sendRoomAction('muteAll')} className="w-full rounded-md border vwc-border vwc-muted-surface px-3 py-2 text-sm vwc-text transition hover:bg-white/10">{t("Mute all guests")}</button>
        </div>}
    </aside>;
}
