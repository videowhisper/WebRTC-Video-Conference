import { t } from '../config/labels';

export function captureConstraints(profile = {}, selection = {}) {
  const requestedRate = Number(profile.frameRate ?? profile.framerate);
  const frameRate = Number.isFinite(requestedRate) && requestedRate > 0 && requestedRate <= 60 ? requestedRate : 15;
  return {
    audio: selection.microphone === 'none' ? false : selection.microphone ? { deviceId: { exact: selection.microphone } } : true,
    video: selection.camera === 'none' ? false : {
      width: { ideal: profile.width || 640, max: profile.width || 640 },
      height: { ideal: profile.height || 360, max: profile.height || 360 },
      frameRate: { ideal: frameRate, max: frameRate },
      ...(selection.camera ? { deviceId: { exact: selection.camera } } : {}),
    },
  };
}
export function mediaFailure(error) {
  switch (error?.name) {
    case 'NotAllowedError': case 'SecurityError': return t('Camera or microphone permission was denied. Update browser permissions, choose other devices, or join without media.');
    case 'NotFoundError': case 'OverconstrainedError': return t('A selected device is unavailable. Refresh the device list and choose another device.');
    case 'NotReadableError': case 'AbortError': return t('A device is busy or could not start. Close other applications using it and retry.');
    case 'MediaUnsupported': return t('Camera and microphone access requires HTTPS and a browser with media support. You can still join without media.');
    default: return t('Camera or microphone unavailable. Choose another device or join without media.');
  }
}
export async function captureMedia(profile, selection, media = navigator.mediaDevices) {
  const constraints = captureConstraints(profile, selection);
  if (!constraints.audio && !constraints.video) return new MediaStream();
  if (!window.isSecureContext || !media?.getUserMedia) throw Object.assign(new Error('media_unavailable'), { name: 'MediaUnsupported' });
  return media.getUserMedia(constraints);
}

/** Deliberately projects only aggregate counters and route classes, never addresses or SDP. */
export async function connectionSnapshot(peers = [], previous = null, now = Date.now()) {
  const result = { sampledAt: now, connectedPeers: 0, videoFramesReceived: 0, videoFramesSent: 0, audioBytesReceived: 0, bytesReceived: 0, packetsLost: 0, roundTripMs: null, route: 'waiting', receiveKbps: null };
  for (const pc of peers) {
    if (pc.connectionState !== 'connected') continue;
    result.connectedPeers++;
    let report;
    try { report = await pc.getStats(); } catch { continue; }
    const selectedPairs = [...report.values()].filter(row => row.type === 'transport' && row.selectedCandidatePairId).map(row => row.selectedCandidatePairId);
    for (const row of report.values()) {
      if (row.type === 'inbound-rtp') {
        result.bytesReceived += Number(row.bytesReceived) || 0;
        result.packetsLost += Math.max(0, Number(row.packetsLost) || 0);
        if ((row.kind || row.mediaType) === 'video') result.videoFramesReceived += Number(row.framesDecoded) || 0;
        if ((row.kind || row.mediaType) === 'audio') result.audioBytesReceived += Number(row.bytesReceived) || 0;
      }
      if (row.type === 'outbound-rtp' && (row.kind || row.mediaType) === 'video') result.videoFramesSent += Number(row.framesEncoded) || 0;
      if (row.type === 'candidate-pair' && row.state === 'succeeded' && (selectedPairs.length ? selectedPairs.includes(row.id) : row.nominated || row.selected)) {
        const local = report.get(row.localCandidateId), remote = report.get(row.remoteCandidateId);
        const relay = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
        if (relay || result.route !== 'relay') result.route = relay ? 'relay' : 'direct';
        if (Number.isFinite(row.currentRoundTripTime)) result.roundTripMs = Math.round(row.currentRoundTripTime * 1000);
      }
    }
  }
  if (previous && now > previous.sampledAt && result.connectedPeers === previous.connectedPeers && result.bytesReceived >= previous.bytesReceived) result.receiveKbps = Math.round((result.bytesReceived - previous.bytesReceived) * 8 / (now - previous.sampledAt));
  return result;
}
