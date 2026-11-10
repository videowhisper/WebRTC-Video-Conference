import { t } from "./config/labels";
import { useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';
import { loadConferenceConfig } from './config/configLoader';
import useConferenceWebRTC from './hooks/useConferenceWebRTC';
import useConferenceStore from './store/useConferenceStore';
import { initializeTheme } from './services/theme';
import Lobby from './components/Lobby';
import Meeting from './components/Meeting';
import StatusView from './components/StatusView';
export default function App() {
  const {
    config,
    currentView,
    error,
    setConfig,
    setError
  } = useConferenceStore();
  const initialized = useRef(false);
  const conference = useConferenceWebRTC();
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initializeTheme();
    loadConferenceConfig().then(setConfig).catch(setError);
  }, [setConfig, setError]);
  useEffect(() => {
    if (!config?.presenceUrl || currentView !== 'Meeting') return;
    const send = present => fetch(config.presenceUrl, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: config.channel, csrf: config.presenceCsrf, present }) }).catch(() => {});
    send(true); const timer = setInterval(() => send(true), 20000);
    return () => { clearInterval(timer); send(false); };
  }, [config?.presenceUrl, config?.presenceCsrf, config?.channel, currentView]);
  if (currentView === 'Loading') {
    return <StatusView icon={<Loader className="h-8 w-8 animate-spin" />} title={t("Loading meeting")} message={t("Preparing VideoWhisper conference configuration.")} />;
  }
  if (currentView === 'Denied') {
    return <StatusView title={t("Conference not configured")} message={config?.deny || error} />;
  }
  if (currentView === 'Error') {
    return <StatusView title={t("Conference error")} message={error} />;
  }
  if (currentView === 'Meeting') return <Meeting conference={conference} />;
  return <Lobby conference={conference} />;
}
