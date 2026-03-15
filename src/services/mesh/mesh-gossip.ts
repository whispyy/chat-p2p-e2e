import type { GossipTransport, PeerRecord, MeshMessage, GossipDigestEntry } from './gossip-transport';

const REGISTRY_KEY = 'peer-chat:registry';
const GOSSIP_INTERVAL = 3_000;
const HEARTBEAT_INTERVAL = 5_000;
const SUSPECTED_THRESHOLD = 10_000;
const OFFLINE_THRESHOLD = 30_000;
const EVICT_THRESHOLD = 300_000;

export class MeshGossip {
  private registry = new Map<string, PeerRecord>();
  private transport: GossipTransport;
  private myPeerId: string;
  private myPubkey: string;
  private gossipTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private failureTimer: ReturnType<typeof setInterval> | null = null;

  constructor(transport: GossipTransport, myPeerId: string, myPubkey: string) {
    this.transport = transport;
    this.myPeerId = myPeerId;
    this.myPubkey = myPubkey;
    this.importFromCache();
  }

  start(): void {
    this.upsertSelf();
    this.transport.onMessage((from, msg) => this.handleMessage(from, msg));

    this.gossipTimer = setInterval(() => this.gossipRound(), GOSSIP_INTERVAL);
    this.heartbeatTimer = setInterval(() => this.broadcastHeartbeat(), HEARTBEAT_INTERVAL);
    this.failureTimer = setInterval(() => this.detectFailures(), HEARTBEAT_INTERVAL);

    // Send initial heartbeat immediately
    this.broadcastHeartbeat();
  }

  stop(): void {
    if (this.gossipTimer) clearInterval(this.gossipTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.failureTimer) clearInterval(this.failureTimer);
    this.gossipTimer = null;
    this.heartbeatTimer = null;
    this.failureTimer = null;
  }

  getRecord(peerId: string): PeerRecord | undefined {
    return this.registry.get(peerId);
  }

  getAllRecords(): PeerRecord[] {
    return Array.from(this.registry.values());
  }

  getOnlinePeers(): PeerRecord[] {
    return this.getAllRecords().filter((r) => r.status === 'online' && r.peerId !== this.myPeerId);
  }

  /** Add or update a peer from an external source (e.g., identity exchange). */
  upsertPeer(peerId: string, pubkey: string): void {
    const existing = this.registry.get(peerId);
    const lamport = (existing?.lamport ?? 0) + 1;
    this.registry.set(peerId, {
      peerId,
      pubkey,
      lastSeen: Date.now(),
      lamport,
      status: 'online',
    });
    this.exportForCache();
  }

  markDisconnected(peerId: string): void {
    const record = this.registry.get(peerId);
    if (record) {
      record.status = 'suspected';
      record.lamport += 1;
      this.exportForCache();
    }
  }

  exportForCache(): void {
    const data = Array.from(this.registry.values());
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(data));
  }

  importFromCache(): void {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      if (!raw) return;
      const records: PeerRecord[] = JSON.parse(raw);
      for (const record of records) {
        const existing = this.registry.get(record.peerId);
        if (!existing || record.lamport > existing.lamport) {
          this.registry.set(record.peerId, record);
        }
      }
    } catch {
      // Ignore corrupt cache
    }
  }

  /** Returns cached peers sorted by lastSeen desc, excluding self. */
  getCachedPeersForReconnect(): PeerRecord[] {
    return Array.from(this.registry.values())
      .filter((r) => r.peerId !== this.myPeerId)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  private upsertSelf(): void {
    const existing = this.registry.get(this.myPeerId);
    this.registry.set(this.myPeerId, {
      peerId: this.myPeerId,
      pubkey: this.myPubkey,
      lastSeen: Date.now(),
      lamport: (existing?.lamport ?? 0) + 1,
      status: 'online',
    });
  }

  private handleMessage(from: string, msg: MeshMessage): void {
    switch (msg.type) {
      case 'HEARTBEAT':
        this.handleHeartbeat(msg.peerId, msg.timestamp);
        break;
      case 'GOSSIP_DIGEST':
        this.handleGossipDigest(from, msg.entries);
        break;
      case 'GOSSIP_PUSH':
        this.handleGossipPush(msg.records);
        break;
      case 'GOSSIP_PULL':
        this.handleGossipPull(from, msg.requested);
        break;
    }
  }

  private handleHeartbeat(peerId: string, timestamp: number): void {
    const record = this.registry.get(peerId);
    if (record) {
      record.lastSeen = Math.max(record.lastSeen, timestamp);
      record.status = 'online';
      record.lamport += 1;
    }
  }

  private handleGossipDigest(from: string, entries: GossipDigestEntry[]): void {
    const toSend: PeerRecord[] = [];
    const toRequest: string[] = [];

    for (const entry of entries) {
      const local = this.registry.get(entry.peerId);
      if (!local) {
        toRequest.push(entry.peerId);
      } else if (entry.lamport > local.lamport) {
        toRequest.push(entry.peerId);
      } else if (entry.lamport < local.lamport) {
        toSend.push(local);
      }
    }

    // Send records we have that are newer
    if (toSend.length > 0) {
      this.transport.send(from, { type: 'GOSSIP_PUSH', records: toSend });
    }
    // Request records they have that are newer
    if (toRequest.length > 0) {
      this.transport.send(from, { type: 'GOSSIP_PULL', requested: toRequest });
    }
  }

  private handleGossipPush(records: PeerRecord[]): void {
    for (const record of records) {
      const local = this.registry.get(record.peerId);
      if (!local || record.lamport > local.lamport) {
        this.registry.set(record.peerId, record);
      }
    }
    this.exportForCache();
  }

  private handleGossipPull(from: string, requested: string[]): void {
    const records: PeerRecord[] = [];
    for (const peerId of requested) {
      const record = this.registry.get(peerId);
      if (record) records.push(record);
    }
    if (records.length > 0) {
      this.transport.send(from, { type: 'GOSSIP_PUSH', records });
    }
  }

  private gossipRound(): void {
    const connected = this.transport.getConnectedPeers();
    if (connected.length === 0) return;

    // Pick up to 3 random peers
    const targets = shuffle(connected).slice(0, 3);
    const digest: GossipDigestEntry[] = Array.from(this.registry.values()).map((r) => ({
      peerId: r.peerId,
      lamport: r.lamport,
    }));

    for (const target of targets) {
      this.transport.send(target, { type: 'GOSSIP_DIGEST', entries: digest });
    }
  }

  private broadcastHeartbeat(): void {
    this.upsertSelf();
    const connected = this.transport.getConnectedPeers();
    const msg: MeshMessage = { type: 'HEARTBEAT', peerId: this.myPeerId, timestamp: Date.now() };
    for (const peerId of connected) {
      this.transport.send(peerId, msg);
    }
  }

  private detectFailures(): void {
    const now = Date.now();
    const toEvict: string[] = [];

    for (const record of this.registry.values()) {
      if (record.peerId === this.myPeerId) continue;
      const age = now - record.lastSeen;

      if (record.status === 'online' && age > SUSPECTED_THRESHOLD) {
        record.status = 'suspected';
        record.lamport += 1;
      } else if (record.status === 'suspected' && age > OFFLINE_THRESHOLD) {
        record.status = 'offline';
        record.lamport += 1;
      } else if (record.status === 'offline' && age > EVICT_THRESHOLD) {
        toEvict.push(record.peerId);
      }
    }

    for (const id of toEvict) {
      this.registry.delete(id);
    }

    if (toEvict.length > 0) {
      this.exportForCache();
    }
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
