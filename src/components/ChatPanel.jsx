import { t } from "../config/labels";
import { useState } from 'react';
import { Send, X } from 'lucide-react';
import useConferenceStore from '../store/useConferenceStore';
export default function ChatPanel({
  conference
}) {
  const {
    room,
    ui,
    setUi
  } = useConferenceStore();
  const [body, setBody] = useState('');
  const send = event => {
    event.preventDefault();
    conference.sendRoomMessage(body);
    setBody('');
  };
  return <aside className="vwc-panel flex flex-col vwc-border vwc-surface">
      <header className="flex h-12 items-center justify-between border-b vwc-border px-4">
        <h2 className="text-sm font-semibold">{t("Chat")}</h2>
        <button type="button" aria-label={t("Close chat")} onClick={() => setUi({
        chatOpen: !ui.chatOpen
      })} className="rounded-md p-1 vwc-secondary hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {(room.messages || []).map((message, index) => <div key={`${message.timestamp || index}:${message.user || message.from}`} className="rounded-md vwc-muted-surface p-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs vwc-secondary">
              <span>{message.displayName || message.user || message.from || t("System")}</span>
              {message.timestamp && <span>{new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}</span>}
            </div>
            <p className="text-sm vwc-text">{message.body || message.message}</p>
          </div>)}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t vwc-border p-3">
        <input aria-label={t("Message")} maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder={t("Message")} className="min-w-0 flex-1 rounded-md border vwc-border vwc-muted-surface px-3 py-2 text-sm outline-none focus:border-cyan-300" />
        <button aria-label={t("Send message")} type="submit" className="rounded-md bg-cyan-300 px-3 text-zinc-950 transition hover:bg-cyan-200">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>;
}
