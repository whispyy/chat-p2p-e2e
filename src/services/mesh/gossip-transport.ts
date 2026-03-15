// ─── Mesh message types ──────────────────────────────────────────────────

export interface GossipDigestEntry {
  peerId: string;
  lamport: number;
}

export interface PeerRecord {
  peerId: string;
  pubkey: string;
  lastSeen: number;
  lamport: number;
  status: 'online' | 'suspected' | 'offline';
}

export type MeshMessage =
  | { type: 'GOSSIP_DIGEST'; entries: GossipDigestEntry[] }
  | { type: 'GOSSIP_PUSH'; records: PeerRecord[] }
  | { type: 'GOSSIP_PULL'; requested: string[] }
  | { type: 'HEARTBEAT'; peerId: string; timestamp: number }
  | { type: 'RECONNECT_REQUEST'; peerId: string; targetPeerId: string; pubkey: string; challenge: string; timestamp: number }
  | { type: 'RECONNECT_ACCEPTED'; peerId: string }
  | { type: 'RECONNECT_REJECTED'; reason: string }
  | { type: 'RELAY_OFFER'; fromPeerId: string; targetPeerId: string; offer: string }
  | { type: 'RELAY_ANSWER'; fromPeerId: string; targetPeerId: string; answer: string }
  | { type: 'RELAY_ICE'; fromPeerId: string; targetPeerId: string; candidate: string }
  | { type: 'CHALLENGE'; nonce: string }
  | { type: 'CHALLENGE_RESPONSE'; nonce: string; signature: string; pubkey: string };

// ─── Transport interface ─────────────────────────────────────────────────

export interface GossipTransport {
  send(peerId: string, message: MeshMessage): void;
  onMessage(handler: (fromPeerId: string, message: MeshMessage) => void): void;
  getConnectedPeers(): string[];
}
