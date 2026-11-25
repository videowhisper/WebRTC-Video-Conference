import { useEffect, useState } from 'react';
import { t } from '../config/labels';
import useConferenceStore from '../store/useConferenceStore';

export default function DevicePanel({ conference, inline = false, disabled = false }) {
  const { socketConnected, socketConnecting, setUi } = useConferenceStore();
  const refreshDiagnostics = conference.refreshDiagnostics;
  const [open, setOpen] = useState(!inline), [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    refreshDiagnostics();
    const timer = setInterval(refreshDiagnostics, 2000);
    return () => clearInterval(timer);
  }, [open, refreshDiagnostics]);
  const diagnostics = conference.diagnostics;
  const field = (kind, key, label, defaultLabel, noneLabel) => {
    const list = conference.devices.filter(device => device.kind === kind);
    const selected = conference.selection[key];
    return <label className="vwc-device-field">{label}<select aria-label={label} value={selected} disabled={disabled || conference.deviceBusy} onChange={event => conference.setSelection({ ...conference.selection, [key]: event.target.value })}>
      <option value="">{defaultLabel}</option><option value="none">{noneLabel}</option>
      {selected && selected !== 'none' && !list.some(device => device.deviceId === selected) && <option value={selected}>{t('Unavailable device; choose another')}</option>}
      {list.filter(device => device.deviceId && device.deviceId !== 'default').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || t('Device name available after permission')}</option>)}
    </select></label>;
  };
  const content = <div className="vwc-device-content">
    {!window.isSecureContext && <p role="alert">{t('Camera and microphone access requires HTTPS. Joining without media is still available.')}</p>}
    {field('videoinput', 'camera', t('Camera'), t('System default camera'), t('Do not use a camera'))}
    {field('audioinput', 'microphone', t('Microphone'), t('System default microphone'), t('Do not use a microphone'))}
    <p className="vwc-secondary">{t('Device names may require browser permission. Checking devices is local and does not join the meeting.')}</p>
    <div className="vwc-device-actions">
      <button type="button" disabled={disabled || conference.deviceBusy} onClick={conference.joined ? conference.applyDevices : conference.checkDevices}>{conference.deviceBusy ? t('Checking devices…') : conference.joined ? t('Apply selected devices') : t('Check selected devices')}</button>
      <button type="button" disabled={disabled || conference.deviceBusy} onClick={conference.refreshDevices}>{t('Refresh device list')}</button>
    </div>
    {conference.deviceStatus && <p role="status">{conference.deviceStatus}</p>}
    <h3>{t('Connection diagnostics')}</h3>
    <dl className="vwc-diagnostic-list">
      <dt>{t('Signaling')}</dt><dd>{socketConnected ? t('Connected') : socketConnecting ? t('Connecting…') : t('Not connected')}</dd>
      <dt>{t('Connected peer connections')}</dt><dd>{diagnostics?.connectedPeers ?? 0}</dd>
      <dt>{t('Media route')}</dt><dd>{diagnostics?.route === 'relay' ? t('Relayed through TURN') : diagnostics?.route === 'direct' ? t('Direct peer connection') : t('Waiting for media')}</dd>
      <dt>{t('Decoded video frames')}</dt><dd>{diagnostics?.videoFramesReceived ?? 0}</dd>
      <dt>{t('Sent video frames')}</dt><dd>{diagnostics?.videoFramesSent ?? 0}</dd>
      <dt>{t('Received audio bytes')}</dt><dd>{diagnostics?.audioBytesReceived ?? 0}</dd>
      <dt>{t('Receive rate (kbps)')}</dt><dd>{diagnostics?.receiveKbps ?? '—'}</dd>
      <dt>{t('Round trip (ms)')}</dt><dd>{diagnostics?.roundTripMs ?? '—'}</dd>
      <dt>{t('Packets lost')}</dt><dd>{diagnostics?.packetsLost ?? 0}</dd>
    </dl>
    <p className="vwc-secondary">{t('Only aggregate counters are shown. Addresses, credentials, room invitations and chat are excluded.')}</p>
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(JSON.stringify({ signaling: socketConnected ? 'connected' : 'not_connected', secureContext: window.isSecureContext, media: diagnostics }, null, 2)); setCopied(true); }
      catch { setCopied(false); }
    }}>{copied ? t('Diagnostics copied') : t('Copy diagnostics')}</button>
  </div>;
  if (inline) return <details className="vwc-device-inline" onToggle={event => setOpen(event.currentTarget.open)}><summary>{t('Camera, microphone & diagnostics')}</summary>{open && content}</details>;
  return <aside className="vwc-panel vwc-device-panel"><header><h2>{t('Devices & connection')}</h2><button type="button" aria-label={t('Close devices and diagnostics')} onClick={() => setUi({ deviceOpen: false })}>×</button></header>{content}</aside>;
}
