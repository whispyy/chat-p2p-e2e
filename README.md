# Peer Chat

A browser-based, serverless P2P chat application with audio calls. No accounts, no servers, no data ever leaves your devices.

---

## Core principles

- **Zero server dependency** — no backend, no database, no relay. Connection metadata (offer/answer) is exchanged manually between peers.
- **Zero external storage** — all data lives in the browser's `localStorage` on each device.
- **Zero new runtime dependencies** — built entirely on native browser APIs (WebRTC, Web Crypto, Web Share, Clipboard, getUserMedia) plus the declared stack (React, TypeScript, styled-components, Vite).
- **Mobile-first** — designed for iOS Safari and Android Chrome first; desktop is a secondary target rendered as a phone-card layout.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Styling | styled-components |
| Bundler | Vite |
| Transport | WebRTC DataChannel + Audio tracks (DTLS-encrypted by default) |
| ICE | Google public STUN only (`stun.l.google.com`) |
| Signaling | Manual offer/answer copy-paste + Web Share API |
| Identity | ECDSA P-256 keypair (WebCrypto), peerId = SHA-256 of public key |
| Persistence | `localStorage` (contacts, message history, keypair, mesh registry) |
| Mesh | Gossip-based peer registry with relay-based reconnection |
| Audio | `getUserMedia` + WebRTC audio tracks via SDP renegotiation |

---

## How it works

### Connection flow

WebRTC requires both peers to exchange connection metadata (SDP offer/answer) before a direct channel can be established. With no signaling server, this is done manually:

```
Alice                                     Bob
  |  "Start new chat"                      |
  |  -> gathers ICE candidates (~2s)       |
  |  -> generates offer code               |
  |  [Share / Copy] ---- any channel ----> |
  |                                        |  opens app -> "Join a chat"
  |                                        |  pastes offer -> generates answer
  |  <------------ any channel --- [Share] |
  |  pastes answer -> Connect              |
  |                                        |
  |<====== WebRTC DataChannel (DTLS) =====>|
```

Once connected, **all data flows peer-to-peer**. The STUN server is only contacted during ICE candidate gathering and never sees message content.

### Identity & mesh

On first launch, each device generates an ECDSA P-256 keypair via the WebCrypto API, persisted as JWK in `localStorage`. The peer ID is derived as `hex(SHA-256(raw public key bytes))`, giving each device a stable cryptographic identity.

When a connection is established, both peers exchange their peer IDs along with their public key and a signature over the peer ID (`{ t: 'id', id, pubkey, sig }`). This allows peers to verify each other's identity cryptographically.

Connected peers are registered in the **mesh layer**, which maintains a gossip-based registry of known peers. The mesh keeps WebRTC connections alive in the background even when the user navigates away from a chat, enabling instant reconnection.

### Mesh reconnection

When a user taps a contact, the app first checks if the peer is already connected in the mesh. If so, the chat reopens instantly on the existing connection — no new SDP exchange needed.

If the direct connection is gone but other peers are available in the mesh, the app attempts relay-based reconnection: it authenticates via challenge-response (signing with the ECDSA key) and bridges SDP signaling through an active peer. If no relay peers are available, it falls back to the manual offer/answer flow.

### Gossip protocol

The mesh layer runs three background processes on connected peers:

- **Gossip rounds** (every 3s) — pick up to 3 random peers, exchange digest of known peer records (peerId + lamport clock), pull/push missing or newer entries
- **Heartbeat** (every 5s) — broadcast alive signal to all connected peers
- **Failure detection** — online -> suspected (10s no heartbeat) -> offline (30s) -> evicted (5min)

The peer registry is cached in `localStorage` (`peer-chat:registry`) and restored on startup.

### Audio calls

Audio calls reuse the existing `RTCPeerConnection` per peer. When a call is initiated, audio tracks are added via SDP renegotiation signaled over the data channel — no new connection is created.

```
Alice                                     Bob
  |  [tap call button]                     |
  |  -- call-request {callId} ---------->  |
  |                                [ring overlay]
  |                                [tap accept]
  |  <--------- call-accept {callId} ---   |
  |                                        |
  |  getUserMedia(audio)        getUserMedia(audio)
  |  pc.addTrack(audio)         pc.addTrack(audio)
  |                                        |
  |  -- call-offer {callId, sdp} ------>   |
  |  <---- call-answer {callId, sdp} ---   |
  |                                        |
  |  <====== bidirectional audio ========> |
  |                                        |
  |  [tap hang up]                         |
  |  -- call-end {callId} ------------->   |
```

**Renegotiation glare** is handled via the polite/impolite pattern: the peer with the lexicographically greater peerId is "polite" and yields (rolls back its own offer) when both sides create offers simultaneously.

**Call state machine**:
```
idle
  |-- start call --------> outgoing_ringing (30s timeout)
  |-- receive call ------> incoming_ringing

outgoing_ringing
  |-- call-accept -------> negotiating (getUserMedia + renegotiate)
  |-- call-reject -------> idle
  |-- timeout/cancel ----> idle

incoming_ringing
  |-- accept ------------> negotiating
  |-- reject ------------> idle
  |-- caller cancels ----> idle

negotiating
  |-- renegotiation ok --> active
  |-- error (mic denied) -> idle

active
  |-- hang up -----------> idle
  |-- peer disconnects --> idle
```

### Wire protocol

DataChannel messages are JSON-encoded envelopes:

```json
{ "t": "msg", "id": "<uuid>", "text": "hello" }         // chat message (with sender-generated ID)
{ "t": "id",  "id": "<peerId>", "pubkey": "...", "sig": "..." }  // identity handshake
{ "t": "ack", "id": "<uuid>" }                           // delivery receipt
{ "t": "mesh", "payload": { "type": "HEARTBEAT", ... } } // mesh protocol messages
{ "t": "call-request", "callId": "<uuid>" }              // initiate call
{ "t": "call-accept", "callId": "<uuid>" }               // accept call
{ "t": "call-reject", "callId": "<uuid>", "reason": "..." }  // decline call
{ "t": "call-offer", "callId": "<uuid>", "sdp": "..." }  // SDP renegotiation offer
{ "t": "call-answer", "callId": "<uuid>", "sdp": "..." } // SDP renegotiation answer
{ "t": "call-end", "callId": "<uuid>" }                  // hang up
```

Mesh message types: `GOSSIP_DIGEST`, `GOSSIP_PUSH`, `GOSSIP_PULL`, `HEARTBEAT`, `RECONNECT_REQUEST`, `RECONNECT_ACCEPTED`, `RECONNECT_REJECTED`, `RELAY_OFFER`, `RELAY_ANSWER`, `RELAY_ICE`, `CHALLENGE`, `CHALLENGE_RESPONSE`.

Plain-text fallback is handled for forward compatibility.

### Message delivery receipts

When a peer receives a chat message, it immediately sends back an `ack` with the message ID. The sender sees the delivery status:

- **Single checkmark** (grey) — message sent
- **Double checkmark** (grey) — message delivered to the peer

Tap a sent message to see a "Sent" or "Delivered" tooltip.

### Online status

The mesh layer tracks which peers have active WebRTC connections. This is surfaced in the UI:

- **Contacts screen** — green dot on avatar + "online" label for connected peers
- **Chat screen** — green dot + "Online" in the header when the peer is connected

---

## Features

### Messaging
- Send and receive text messages in real time over WebRTC DataChannel
- Delivery receipts: single check (sent) / double check (delivered), tap for label
- Background message handling: messages stored and acked even when not in the chat screen
- Unread count badge on contacts list with live updates
- Shift+Enter inserts a newline on mobile; Enter sends on desktop (detected via `pointer: coarse`)
- Auto-growing textarea (expands up to 140px, then scrolls internally)
- Message formatting parsed inline:
  - `**bold**` or `__bold__`
  - `*italic*` or `_italic_`
  - `` `inline code` ``
  - `~~strikethrough~~`
  - `https://...` -> clickable link (opens in new tab)
- Newlines preserved visually in received messages
- Grouped message bubbles: consecutive messages from the same sender share border-radius (iMessage-style), with a single timestamp per group

### Audio calls
- One-tap audio call initiation from the chat header (phone icon)
- Full-screen incoming call overlay with accept/reject buttons (works from any screen)
- Active call bar with live duration timer, mute toggle, and hang up button
- SDP renegotiation over existing data channel — no new connection needed
- Polite/impolite pattern prevents renegotiation glare
- 30-second ring timeout with auto-cancel
- Graceful handling of microphone permission denial
- Busy rejection when already in a call
- Call button disabled when peer is offline

### Contacts & history
- Persistent ECDSA-based identity per device (generated once, stored in `localStorage`)
- Contacts created automatically on first connection with a new peer
- Conversation history saved locally and loaded on reconnect
- Instant reconnection to online peers (tapping a contact reuses the mesh connection)
- Online status indicator (green dot) on the contacts list
- Unread message count badge with bold preview for unread conversations
- Contacts screen replaces the home screen after the first conversation
- Settings panel (gear icon) on the contacts screen:
  - **Export backup** — downloads a versioned JSON file (`peer-chat-backup-YYYY-MM-DD.json`) containing identity, contacts, and full message history
  - **Import backup** — restores from a previously exported file; acts as full device migration (identity preserved)
  - **Reset all data** — removes all `peer-chat:*` keys from `localStorage` after inline confirmation
- **Restore from backup** shortcut on the home screen for fresh-install migrations

### Design
- Dark theme throughout: home, contacts, offer, and join screens
- Light theme for the chat screen (deliberate contrast after connection)
- Frosted glass header in chat with backdrop blur
- Ambient animated blob background on dark screens
- Subtle `fadeSlideIn` animation on incoming messages
- Colored avatar per contact (deterministic from peer ID)
- Last message preview and relative timestamp in contacts list

### Mobile
- `viewport-fit=cover` + `env(safe-area-inset-*)` on all interactive edges
- `user-scalable=no, maximum-scale=1` prevents zoom on input focus
- All inputs use `font-size: 16px` (iOS zoom threshold)
- Web Share API (`navigator.share`) for native share sheet; falls back to clipboard
- Scrollbars hidden on all scrollable containers

### Desktop
- Renders as a centred phone-card (max-width 480px, rounded corners, drop shadow)
- Enter sends, Shift+Enter inserts a newline

---

## Architecture

```
src/
  services/
    webrtc.service.ts     WebRTC lifecycle, ICE, DataChannel, audio tracks, renegotiation
    chat.service.ts       Message send wrapper
    call.service.ts       Call state machine, polite/impolite renegotiation, getUserMedia
    identity.service.ts   ECDSA identity delegation, shortId, defaultPeerName
    storage.service.ts    Contacts + message CRUD, unread tracking, export/import/clear
    mesh/
      mesh-identity.ts    ECDSA P-256 keypair (WebCrypto), sign/verify, peerId derivation
      gossip-transport.ts GossipTransport interface + MeshMessage type union
      mesh-gossip.ts      Peer registry, gossip rounds, heartbeat, failure detection
      mesh-reconnector.ts Relay-based reconnection with challenge-response auth
      mesh-node.ts        Orchestrator: connections, mesh messages, call routing
      index.ts            Barrel exports
  utils/
    encoding.ts           encodeSignal / decodeSignal (base64 JSON SDP)
    share.ts              Web Share API with clipboard fallback
    formatting/
      types.ts            Segment and Formatter interfaces
      formatters.ts       Ordered list of inline formatting rules
      parser.ts           Pipeline: string -> Segment[]
      renderer.tsx        Segment[] -> React nodes
      index.ts            Public re-exports
  hooks/
    useWebRTC.ts          Connection state machine + mesh integration + identity wiring
    useChat.ts            Messages state + persistence + delivery receipts
    useCall.ts            Call state, duration timer, remote audio playback
  screens/
    HomeScreen.tsx        First-launch: new chat / join chat / restore from backup
    ContactsScreen.tsx    Returning user: contacts list + online status + unread badges
    OfferScreen.tsx       Alice: generate and share offer, paste answer
    JoinScreen.tsx        Bob: paste offer, share answer
    ChatScreen.tsx        Live chat + message list + online indicator + call UI
  components/
    Message.tsx           Single message bubble (grouped radius, formatting, delivery check, tap tooltip)
    MessageInput.tsx      Auto-growing textarea + send button
    ActiveCallBar.tsx     In-call bar: duration, mute toggle, hang up
    IncomingCallOverlay.tsx  Full-screen overlay: caller name, accept/reject
    CodeBlock.tsx         Dark-themed code area for offer/answer codes
    SettingsModal.tsx     Bottom sheet: export / import / reset data
  types/
    index.ts              ConnectionState, CallState, Message, Contact, CallSignalMessage
```

### Connection state machine

```
idle ----------------------------------------> error
  |                                              ^
  |-[startOffer]---> gathering                   |
  |                    |                         |
  |              awaiting_answer ----------------+
  |                    |                         |
  |               [submitAnswer]                 |
  |                    +----------> connected    |
  |                                              |
  |-[startJoin]---> joining                      |
  |                    |                         |
  |             generating_answer ---------------+
  |                    |                         |
  |                has_answer ------------------>|
  |                    |
  |             [channel opens]
  |                    +----------> connected
  |
  +-[reconnect]---> reconnecting --> connected
                         |              ^
                         |              |
                         +-- (mesh has peer) -- instant reopen
                         +-- (relay available) -- relay SDP
                         +-- (fallback) ------> gathering
```

### Call state machine

```
idle -------[start call]-------> outgoing_ringing (30s timeout)
  |                                   |
  |--[receive call-request]           |--[call-accept]-----> negotiating
  |         |                         |--[call-reject]-----> idle
  |         v                         |--[timeout/cancel]--> idle
  |  incoming_ringing                 |
  |    |--[accept]---> negotiating    |
  |    |--[reject]---> idle           |
  |    |--[caller cancels]--> idle    |
  |                                   |
  |            negotiating            |
  |              |--[success]-------> active
  |              |--[mic denied]----> idle
  |                                   |
  |                active             |
  |                  |--[hang up]---> idle
  |                  |--[disconnect]-> idle
```

### Mesh layer

```
UI -> useWebRTC -> MeshNode -> WebRTCService[] (multiple connections)
                     |-- MeshIdentity (ECDSA keypair, challenge-response)
                     |-- MeshGossip (registry, failure detection)
                     |-- MeshReconnector (relay signaling)
                     +-- CallService[] (per-peer call state machines)
```

The mesh layer is **additive** — it sits alongside the existing code. The manual signaling flow (copy-paste SDP) remains the primary way to establish first contact. The mesh kicks in for reconnection and peer discovery after that. Audio calls reuse the same peer connections managed by the mesh.

### Formatting pipeline

Adding a new formatter requires only two steps:
1. Add a `Segment` kind to `types.ts`
2. Append a `Formatter` entry to `formatters.ts`
3. Add a render case to `renderer.tsx`

The `parser.ts` pipeline applies formatters in order — earlier entries consume their tokens first (bold before italic).

---

## Known limitations

- **STUN only, no TURN** — connections fail (~20% of cases) when both peers are behind symmetric NAT (common on mobile data / corporate networks). Adding a TURN server would resolve this. This affects both chat and audio calls.
- **Offer lifetime** — ICE candidates (especially STUN-derived) expire when NAT bindings time out (typically 30 seconds to a few minutes). The offering tab must remain open until the peer connects.
- **localStorage limits** — browsers typically cap `localStorage` at 5-10 MB. Long conversations with many peers may eventually hit this limit. Migrating to `IndexedDB` is the natural next step.
- **Mesh reconnection requires at least 3 peers** — relay-based reconnection only works when a third peer can bridge signaling. With only 2 devices and both offline, manual SDP exchange is required. However, if both devices stay on the app, the mesh connection persists and instant reconnection works.
- **Audio calls require microphone permission** — the browser will prompt for mic access on the first call. If denied, the call fails gracefully with an error message.
- **No end-to-end encryption beyond DTLS** — WebRTC DataChannel and audio are DTLS/SRTP-encrypted at the transport layer. Application-level E2E encryption (e.g. with Web Crypto ECDH key exchange) is not yet implemented.

---

## Development

```bash
npm install
npm run dev      # start dev server at http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build locally
```

---

## Decision log

| Decision | Rationale |
|---|---|
| WebRTC DataChannel | Browser-native, DTLS-encrypted, NAT-traversing, no server needed for data |
| STUN only (no TURN) | Avoids any relay infrastructure; ~20% failure rate accepted for MVP |
| Manual signaling | Truly serverless; Web Share API makes it low-friction on mobile |
| ECDSA P-256 for identity | Cryptographic peer identity; enables challenge-response auth for mesh reconnection; replaces plain UUID |
| Gossip-based mesh | Decentralized peer discovery; no coordinator needed; tolerant of partial connectivity |
| Relay reconnection | Reuses existing peer connections as signaling bridges; avoids manual re-exchange when possible |
| Reuse RTCPeerConnection for calls | Audio tracks added via renegotiation on the same PC; avoids managing a second connection per peer |
| Polite/impolite renegotiation | Standard WebRTC pattern to resolve simultaneous offer glare without a coordinator |
| Call signaling over data channel | Call setup messages flow over the existing reliable data channel; no additional signaling infrastructure |
| `localStorage` for persistence | Zero-dependency, synchronous, sufficient for MVP message volumes |
| Single-page state machine (no router) | Linear flow with few screens; router adds no value at this scale |
| Enter sends on desktop, not mobile | `pointer: coarse` detects touchscreen reliably; mobile keyboard shows return key |
| `font-size: 16px` on all inputs | iOS Safari zooms on focus when `font-size < 16px` |
| `user-scalable=no` in viewport | Prevents browser zoom on input focus across all mobile browsers |
| Formatting via custom pipeline (no library) | Zero dependency; easily extensible by appending to `formatters.ts` |
| `overflow: hidden` on html/body/#root | Prevents body-level scrollbar; scrolling managed per-container |
| Separate `peer-chat:msgs:<id>` keys | Contacts store is metadata-only; `appendMessage` reads/writes one contact's messages instead of the full history of all contacts |
| Export includes identity | Enables full device migration — peer contacts will still recognise the restored device |
| Delivery receipts via `ack` | Lightweight; sender includes message ID, receiver echoes it back; no server needed |
| Grey checkmarks (not blue) | Avoids confusion with "read receipts" (blue = read in other apps); tap tooltip clarifies "Sent" vs "Delivered" |
| Keep mesh connections alive on chat exit | Enables instant reconnection, background message storage, and call reception without re-establishing WebRTC |
| Background message handling in MeshNode | Messages stored + acked at the transport layer regardless of UI state; prevents message loss when user is on home screen |
| Unread count in Contact model | Incremented on background message receipt, cleared on chat open; enables badge display without scanning message history |
