import { t } from "../config/labels";
import { Camera, CameraOff, Hand, LogOut, MessageSquare, Mic, MicOff, MonitorUp, MonitorX, Users, Settings, Radio } from 'lucide-react';
import useConferenceStore from '../store/useConferenceStore';
function ControlButton({
  children,
  label,
  active,
  danger,
  disabled,
  onClick,
  pressed
}) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} title={label} aria-label={label} className={`flex h-11 w-11 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'border-red-400/30 bg-red-500 text-white hover:bg-red-400' : active ? 'border-cyan-300/50 bg-cyan-300 text-zinc-950 hover:bg-cyan-200' : 'vwc-border vwc-muted-surface vwc-text hover:bg-zinc-700'}`}>
      {children}
    </button>;
}
export default function Controls({
  conference
}) {
  const {
    ui,
    setUi,
    config,
    localStreams,
    room,
    socket
  } = useConferenceStore();
  const handRaised = !!room.participants[socket?.id]?.hand;
  const canShare = config?.conference?.allowScreenShare !== false;
  return <div className="vwc-controls flex justify-center px-3">
      <div className="vwc-control-buttons flex max-w-full items-center gap-2 rounded-full border vwc-border vwc-surface p-2 shadow-2xl backdrop-blur">
        {conference.pushToTalkEnabled ? <button type="button" aria-label={t('Hold to talk')} aria-describedby="vwc-ptt-help" aria-pressed={conference.micEnabled} disabled={!conference.joined || conference.deviceBusy || !localStreams.camera?.getAudioTracks().length} className={`vwc-ptt-button ${conference.micEnabled ? 'vwc-ptt-active' : ''}`}
          onPointerDown={event => { if (event.button !== 0 || !event.isPrimary) return; event.currentTarget.setPointerCapture(event.pointerId); conference.startTalking('pointer:' + event.pointerId); }}
          onPointerUp={event => conference.stopTalking('pointer:' + event.pointerId)} onPointerCancel={event => conference.stopTalking('pointer:' + event.pointerId)} onLostPointerCapture={event => conference.stopTalking('pointer:' + event.pointerId)}
          onKeyDown={event => { if (![' ', 'Enter'].includes(event.key)) return; event.preventDefault(); if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) conference.startTalking('key:' + event.key); }}
          onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); conference.stopTalking('key:' + event.key); } }}
          onBlur={conference.releaseTalk} onContextMenu={event => event.preventDefault()}>
          {conference.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}<span>{t('Hold to talk')}</span>
        </button> : <ControlButton label={conference.micEnabled ? t("Mute microphone") : t("Unmute microphone")} disabled={!localStreams.camera?.getAudioTracks().length} danger={!conference.micEnabled} onClick={conference.toggleMic}>
          {conference.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>}
        <ControlButton label={conference.pushToTalkEnabled ? t('Disable push to talk') : t('Enable push to talk')} active={conference.pushToTalkEnabled} pressed={conference.pushToTalkEnabled} onClick={() => conference.setPushToTalkEnabled(!conference.pushToTalkEnabled)}><Radio size={20} /></ControlButton>
        <span id="vwc-ptt-help" className="sr-only">{t('Hold the button, or focus it and hold Space or Enter, to speak. Release to mute. Turning push to talk off leaves the microphone muted.')}</span>
        <ControlButton label={conference.cameraEnabled ? t("Stop camera") : t("Start camera")} disabled={!localStreams.camera?.getVideoTracks().length} danger={!conference.cameraEnabled} onClick={conference.toggleCamera}>
          {conference.cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </ControlButton>
        {canShare && <ControlButton label={conference.screenSharing ? t("Stop sharing") : t("Share screen")} active={conference.screenSharing} onClick={conference.screenSharing ? conference.stopScreenShare : conference.startScreenShare}>
            {conference.screenSharing ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
          </ControlButton>}
        <ControlButton label={handRaised ? t("Lower hand") : t("Raise hand")} active={handRaised} pressed={handRaised} onClick={() => conference.sendRoomAction(handRaised ? 'lowerHand' : 'raiseHand')}>
          <Hand className="h-5 w-5" />
        </ControlButton>
        <span className="sr-only" aria-live="polite">{handRaised ? t('Your hand is raised.') : ''}</span>
        
        <ControlButton label={t("Devices & connection")} active={ui.deviceOpen} onClick={() => setUi({ deviceOpen: !ui.deviceOpen, chatOpen: false, peopleOpen: false, inviteOpen: false })}><Settings className="h-5 w-5" /></ControlButton>
        <ControlButton label={t("Chat")} active={ui.chatOpen} onClick={() => setUi({
        chatOpen: !ui.chatOpen, peopleOpen: false, inviteOpen: false, deviceOpen: false
      })}>
          <MessageSquare className="h-5 w-5" />
        </ControlButton>
        <ControlButton label={t("People")} active={ui.peopleOpen} onClick={() => setUi({
        peopleOpen: !ui.peopleOpen,
        chatOpen: false, inviteOpen: false, deviceOpen: false
      })}>
          <Users className="h-5 w-5" />
        </ControlButton>
        <button type="button" onClick={() => {
        conference.leaveRoom();
        useConferenceStore.getState().setView('Lobby');
      }} className="flex h-11 items-center gap-2 rounded-full bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400">
          <LogOut className="h-4 w-4" />{t("Leave")}</button>
      </div>
    </div>;
}
