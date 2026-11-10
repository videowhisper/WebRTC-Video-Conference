import { t } from "../config/labels";
import { Camera, CameraOff, Hand, LogOut, MessageSquare, Mic, MicOff, MonitorUp, MonitorX, Users } from 'lucide-react';
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
        <ControlButton label={conference.micEnabled ? t("Mute microphone") : t("Unmute microphone")} disabled={!localStreams.camera?.getAudioTracks().length} danger={!conference.micEnabled} onClick={conference.toggleMic}>
          {conference.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
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
        
        <ControlButton label={t("Chat")} active={ui.chatOpen} onClick={() => setUi({
        chatOpen: !ui.chatOpen, peopleOpen: false, inviteOpen: false
      })}>
          <MessageSquare className="h-5 w-5" />
        </ControlButton>
        <ControlButton label={t("People")} active={ui.peopleOpen} onClick={() => setUi({
        peopleOpen: !ui.peopleOpen,
        chatOpen: false, inviteOpen: false
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
