const errors = {
  "roomFull": "This meeting is full.",
  "roomLocked": "This meeting is locked.",
  "removedFromRoom": "You were removed from this meeting.",
  "sessionExpired": "Your session expired. Reload the page to rejoin.",
  "roomDenied": "You cannot join this meeting.",
  "duplicateUser": "This browser session is already in the meeting.",
  "planLimit": "The configured server plan cannot publish this stream.",
  "publishDenied": "Publishing this stream is not permitted.",
  "actionDenied": "This action requires a host.",
  "rateLimited": "Too many requests. Please wait.",
  "signalDenied": "Media signaling was rejected.",
  "invalidPayload": "The meeting request is invalid.",
  "notJoined": "Join the meeting before continuing.",
  "invalidMessage": "Enter a message of up to 2000 characters.",
  "invalidSignal": "The media signaling request is invalid."
};
export function t(text) { const label = errors[text] || text; return window.videowhisperConfig?.labels?.[label] || label; }
