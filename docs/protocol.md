# Conference protocol v1

This is an additive Socket.IO namespace at `https://SIGNALING-ORIGIN/conference`, using the existing `/socket.io` transport path. It requires VideoWhisper server 2026.11.10 or later with CONFERENCE_ENABLED=1. Legacy default-namespace events remain unchanged; the new app fails closed if the conference handshake is absent.

## Authentication

Browser handshake: `{account,user,pin}`. PIN is an HMAC-signed, room-scoped bearer credential created by the PHP or WordPress host. The account token/signing key are never sent to the browser. Node posts `{account,user,pin,token}` to the account's configured loginURL. Only a successful server-to-server response may supply:

```json
{"login":true,"conference":{"version":1,"room":"Meeting_RANDOM","role":"guest","expires":1999999999,"maxParticipants":4}}
```

The timestamp above illustrates Unix seconds only; issue a current expiry of at most one hour. Expired/overlong claims, invalid IDs, unknown roles and capacity outside 2–4 are rejected. WordPress also rejects callbacks for unpublished/deleted meetings. WordPress identity/role changes can leave an already issued PIN valid for up to one hour; reload/expiry reauthorizes the participant. Deployments needing immediate global revocation should add a server-verified session registry before use.

Server emits `conferenceReady({version:1,peerConfig,expires})`. Client waits for it before emitting `roomJoin`. External signaling starts only after explicit participant consent. No implicit room join occurs in the lobby.

## Rooms and media

- `roomJoin({room,options:{participant:{displayName}}})` → `roomUpdate({room,type:'roomJoin',participants,streams,messages,meta,revision})`.
- `roomGetState({room})` → full `type:'roomState'`. Snapshot revision is diagnostic; missed events are recovered by a fresh join/snapshot after disconnect.
- `roomPublish({room,stream,parameters})`; stream must be `${room}:${authenticatedUser}:camera` or `:screen`. Parameters include kind/type and bounded width/height/frameRate/videoBitrate/audioBitrate.
- Server sends `message({type:'peers',channel,peers:[{peerID}]})` to a publisher, or `type:'peer'` on a late join. Publisher sends offers; subscriber sends answers.
- `messagePeer({type,channel,target,content|candidate})` routes only within the authorized account and joined room, between that stream's publisher and a subscribed participant. Server replaces `from` with authenticated identity and strips peer-supplied ICE config.
- `roomUnpublish({room,stream})`, `roomLeave({room})`, and disconnect remove ownership-bound streams. Empty rooms and their chat disappear.

Client queues ICE until a remote description exists, separates camera/screen channels, closes old peers after transport loss, retains local tracks during a temporary reconnect, and rejoins/republishes when conferenceReady returns. Explicit leave/unmount/removal/expiry stops media and disconnects. A failed media connection asks the participant to leave/rejoin; seamless ICE restart during a connected signaling session is not claimed.

## State and actions

`participantUpdate({room,patch})` accepts only boolean mic/camera/hand/screen fields. Roles/permissions remain server-derived. Chat uses `roomMessage({room,message:{body}})`, bounded to 2000 characters and 100 in-memory items; identity/time are server-derived. React renders body as text.

`roomAction({room,action,target})`: raiseHand/lowerHand for self; requestMute/muteAll/removeParticipant/spotlight/lockRoom/unlockRoom for authenticated host. Mute requests disable the receiving app's audio track and update its indicator; another participant can never force a remote device to unmute. Pin is local UI state. Recording/reactions/lobby admission are not implemented.

Errors use `roomUpdate({room,type:'error',code})`; removedFromRoom/sessionExpired are terminal. Browser labels translate stable codes. Server/transport authentication failures use a generic reconnect/setup message without tokens, ICE credentials or raw internals.

## Limits

Small-room mesh only; publishing to three other participants multiplies upstream bandwidth and peer count. The Free profile is 640×360, 15 fps, 180 kbps video and 32 kbps audio, further restricted by the account plan. TURN-only/cross-network/device reliability must be measured on the actual infrastructure. This namespace does not add an SFU or a media recorder.
