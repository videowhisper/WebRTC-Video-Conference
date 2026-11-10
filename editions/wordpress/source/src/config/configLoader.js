import { generateId, getGETParam, isConfigKeyLocked } from './configUtils';

let configPromise = null;

export async function loadConferenceConfig() {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    const scriptConfig = window.videowhisperConfig || {};
    const configFiles = ['./config.json', './unconfigured.json'];
    let json = scriptConfig.videowhisperServer || scriptConfig.deny ? {} : null;
    let configSource = null;

    for (const configFile of (json ? [] : configFiles)) {
      const configUrl = scriptConfig.configUrl || configFile;
      try {
        const response = await fetch(configUrl);
        if (response.ok) {
          json = await response.json();
          configSource = configUrl;
          break;
        }
      } catch {
        // Try the next candidate.
      }
      if (scriptConfig.configUrl) break;
    }

    if (!json) throw new Error('Unable to load VideoWhisper conference configuration.');

    const merged = {
      ...json,
      ...scriptConfig,
      configSource,
    };

    if (merged.enableGET) {
      const channelGET = getGETParam('channel');
      const roomGET = getGETParam('room');
      const viewGET = getGETParam('view');
      const nameGET = getGETParam('name');

      if ((channelGET || roomGET) && !isConfigKeyLocked(merged.configLock, merged, 'channel')) {
        merged.channel = channelGET || roomGET;
      }
      if (viewGET && !isConfigKeyLocked(merged.configLock, merged, 'view')) merged.view = viewGET;
      if (nameGET && !isConfigKeyLocked(merged.configLock, merged, 'displayName')) merged.displayName = nameGET;
    }

    if (!merged.channel || merged.channel === '{generate}') {
      merged.channel = `Meeting${generateId(5)}`;
    }

    if (!merged.username || merged.username === '{generate}') {
      merged.username = `${merged.view || 'Conference'}${generateId(4)}_${merged.channel}`;
    }

    if (!merged.displayName || merged.displayName === '{username}') {
      merged.displayName = merged.username;
    }

    if (merged.videowhisperServer?.user === '{username}') {
      merged.videowhisperServer = {
        ...merged.videowhisperServer,
        user: merged.username,
      };
    }

    return merged;
  })();

  return configPromise;
}
