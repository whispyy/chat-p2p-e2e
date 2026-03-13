# Peer Chat

A browser-based, serverless P2P chat application. No accounts, no servers, no data ever leaves your devices.

---

## Core principles

- **Zero server dependency** — no backend, no database, no relay. Connection metadata (offer/answer) is exchanged manually between peers.
- **Zero external storage** — all data lives in the browser's `localStorage` on each device.
- **Zero new runtime dependencies** — built entirely on native browser APIs (WebRTC, Web Crypto, Web Share, Clipboard) plus the declared stack (React, TypeScript, styled-components, Vite).
- **Mobile-first** — designed for iOS Safari and Android Chrome first; desktop is a secondary target rendered as a phone-card layout.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Styling | styled-components |
| Bundler | Vite |
| Transport | WebRTC DataChannel (DTLS-encrypted by default) |
| ICE | Google public STUN only (`stun.l.google.com`) |
| Signaling | Manual offer/answer copy-paste + Web Share API |
| Identity | `crypto.randomUUID()` stored in `localStorage` |
| Persistence | `localStorage` (contacts + message history) |

---

## How it works

### Connection flow

WebRTC requires both peers to exchange connection metadata (SDP offer/answer) before a direct channel can be established. With no signaling server, this is done manually:

```
Alice                                     Bob
  │  "Start new chat"                      │
  │  → gathers ICE candidates (~2s)        │
  │  → generates offer code               │
  │  [Share / Copy] ──── any channel ───► │
  │                                        │  opens app → "Join a chat"
  │                                        │  pastes offer → generates answer
  │  ◄──────────── any channel ─── [Share]│
  │  pastes answer → Connect              │
  │                                        │
  │◄══════ WebRTC DataChannel (DTLS) ═════│
```

Once connected, **all data flows peer-to-peer**. The STUN server is only contacted during ICE candidate gathering and never sees message content.

### Identity & contacts

On first launch, each device generates a persistent UUID (`crypto.randomUUID()`) stored in `localStorage`. When a connection is established, both peers exchange their UUIDs over the DataChannel as the first message (`{ t: 'id', id }`).

This UUID becomes the contact's stable identity. Subsequent reconnections with the same peer match to the same contact, loading their conversation history automatically.

### Message persistence

Messages are stored per-contact in `localStorage` under `peer-chat:contacts`. Both sent and received messages are written on every exchange. History loads automatically when reconnecting to a known peer.

### Wire protocol

DataChannel messages are JSON-encoded envelopes:

```json
{ "t": "msg", "text": "hello" }   // chat message
{ "t": "id",  "id": "<uuid>" }    // identity handshake (sent on channel open)
```

Plain-text fallback is handled for forward compatibility.

---

## Features

### Messaging
- Send and receive text messages in real time over WebRTC DataChannel
- Shift+Enter inserts a newline on mobile; Enter sends on desktop (detected via `pointer: coarse`)
- Auto-growing textarea (expands up to 140px, then scrolls internally)
- Message formatting parsed inline:
  - `**bold**` or `__bold__`
  - `*italic*` or `_italic_`
  - `` `inline code` ``
  - `~~strikethrough~~`
  - `https://...` → clickable link (opens in new tab)
- Newlines preserved visually in received messages
- Grouped message bubbles: consecutive messages from the same sender share border-radius (iMessage-style), with a single timestamp per group

### Contacts & history
- Persistent UUID-based identity per device (generated once, stored in `localStorage`)
- Contacts created automatically on first connection with a new peer
- Conversation history saved locally and loaded on reconnect
- Contacts screen replaces the home screen after the first conversation

### Design
- Dark theme throughout: home, contacts, offer, and join screens
- Light theme for the chat screen (deliberate contrast after connection)
- Frosted glass header in chat with backdrop blur
- Ambient animated blob background on dark screens
- Subtle `fadeSlideIn` animation on incoming messages
- Colored avatar per contact (deterministic from peer UUID)
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
    webrtc.service.ts     WebRTC lifecycle, ICE, DataChannel, JSON wire protocol
    chat.service.ts       Message creation and routing over the DataChannel
    identity.service.ts   UUID generation, shortId, defaultPeerName
    storage.service.ts    Contacts + message CRUD (localStorage)
  utils/
    encoding.ts           encodeSignal / decodeSignal (base64 JSON SDP)
    share.ts              Web Share API with clipboard fallback
    formatting/
      types.ts            Segment and Formatter interfaces
      formatters.ts       Ordered list of inline formatting rules
      parser.ts           Pipeline: string → Segment[]
      renderer.tsx        Segment[] → React nodes
      index.ts            Public re-exports
  hooks/
    useWebRTC.ts          Connection state machine + identity wiring
    useChat.ts            Messages state + persistence
  screens/
    HomeScreen.tsx        First-launch: new chat / join chat
    ContactsScreen.tsx    Returning user: contacts list + actions
    OfferScreen.tsx       Alice: generate and share offer, paste answer
    JoinScreen.tsx        Bob: paste offer, share answer
    ChatScreen.tsx        Live chat + message list
  components/
    Message.tsx           Single message bubble (grouped radius, formatting)
    MessageInput.tsx      Auto-growing textarea + send button
    CodeBlock.tsx         Dark-themed code area for offer/answer codes
  types/
    index.ts              ConnectionState, Message, MessagePosition, Contact
```

### Connection state machine

```
idle ──────────────────────────────────────► error
  │                                            ▲
  ├─[startOffer]──► gathering                  │
  │                    │                       │
  │              awaiting_answer ──────────────┤
  │                    │                       │
  │               [submitAnswer]               │
  │                    └──────────► connected  │
  │                                            │
  └─[startJoin]──► joining                     │
                      │                        │
               generating_answer ──────────────┤
                      │                        │
                  has_answer ─────────────────►│
                      │
               [channel opens]
                      └──────────► connected
```

### Formatting pipeline

Adding a new formatter requires only two steps:
1. Add a `Segment` kind to `types.ts`
2. Append a `Formatter` entry to `formatters.ts`
3. Add a render case to `renderer.tsx`

The `parser.ts` pipeline applies formatters in order — earlier entries consume their tokens first (bold before italic).

---

## Known limitations

- **STUN only, no TURN** — connections fail (~20% of cases) when both peers are behind symmetric NAT (common on mobile data / corporate networks). Adding a TURN server would resolve this.
- **Offer lifetime** — ICE candidates (especially STUN-derived) expire when NAT bindings time out (typically 30 seconds to a few minutes). The offering tab must remain open until the peer connects.
- **localStorage limits** — browsers typically cap `localStorage` at 5–10 MB. Long conversations with many peers may eventually hit this limit. Migrating to `IndexedDB` is the natural next step.
- **No message delivery confirmation** — there is no read receipt or delivery guarantee beyond the DataChannel's built-in reliability.
- **No end-to-end encryption beyond DTLS** — WebRTC DataChannel is DTLS-encrypted at the transport layer. Application-level E2E encryption (e.g. with Web Crypto ECDH key exchange) is not yet implemented.

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
| `crypto.randomUUID()` for identity | No keypair complexity for MVP; sufficient for contact matching; upgradeable to ECDH later |
| `localStorage` for persistence | Zero-dependency, synchronous, sufficient for MVP message volumes |
| Single-page state machine (no router) | Linear flow with few screens; router adds no value at this scale |
| Enter sends on desktop, not mobile | `pointer: coarse` detects touchscreen reliably; mobile keyboard shows return key |
| `font-size: 16px` on all inputs | iOS Safari zooms on focus when `font-size < 16px` |
| `user-scalable=no` in viewport | Prevents browser zoom on input focus across all mobile browsers |
| Formatting via custom pipeline (no library) | Zero dependency; easily extensible by appending to `formatters.ts` |
| `overflow: hidden` on html/body/#root | Prevents body-level scrollbar; scrolling managed per-container |
