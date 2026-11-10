import { useState } from 'react';
import { Copy, Share2, X } from 'lucide-react';
import { t } from '../config/labels';
import useConferenceStore from '../store/useConferenceStore';
export default function InvitePanel({ inline = false }) {
  const { config, setUi } = useConferenceStore();
  const [status, setStatus] = useState('');
  let url = '';
  try { const value = new URL(config?.inviteUrl); if (['https:', 'http:'].includes(value.protocol) && !value.username && !value.password) url = value.href; } catch { /* Host supplies the invitation, never derive it from a PIN/config URL. */ }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setStatus(t('Invitation link copied.')); } catch { setStatus(t('Select and copy the invitation link below.')); } };
  const share = async () => { try { await navigator.share({ title: config.title, url }); setStatus(t('Invitation shared.')); } catch { setStatus(t('Sharing cancelled. You can copy the link instead.')); } };
  const Tag = inline ? 'section' : 'aside';
  return <Tag className={inline ? "vwc-invite vwc-invite-inline" : "vwc-panel vwc-invite"} aria-label={t('Invite participants')}>
    <header><h2>{t('Invite participants')}</h2>{!inline && <button type="button" aria-label={t('Close invitations')} onClick={() => setUi({ inviteOpen: false })}><X size={18} /></button>}</header>
    <div className="vwc-panel-content">
      <p>{config?.roomAccess === 'private' ? t('Anyone with this private invitation can join. Keep its access key private.') : config?.roomAccess === 'members' ? t('Participants must sign in on this site before joining.') : t('Anyone with this link can join this public room.')}</p>
      {url ? <><label htmlFor="vwc-invite-url">{t('Invitation link')}</label><input id="vwc-invite-url" readOnly value={url} onFocus={e => e.target.select()} /><button type="button" className="vwc-primary" onClick={copy}><Copy size={16} />{t('Copy invitation link')}</button>{typeof navigator.share === 'function' && <button type="button" onClick={share}><Share2 size={16} />{t('Share invitation')}</button>}</> : <p>{t('Ask the meeting owner for an invitation link.')}</p>}
      <p role="status">{status}</p><p>{t('Open the same invitation in another browser or send it to your participants. Creating another room starts a separate meeting.')}</p>
    </div>
  </Tag>;
}
