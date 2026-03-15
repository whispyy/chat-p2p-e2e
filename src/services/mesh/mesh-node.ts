import type { GossipTransport, MeshMessage } from './gossip-transport';
import type { Message } from '../../types';
import { MeshGossip } from './mesh-gossip';
import { MeshReconnector } from './mesh-reconnector';
import * as MeshIdentity from './mesh-identity';
import { WebRTCService } from '../webrtc.service';
import { ChatService } from '../chat.service';
import { upsertContact, appendMessage } from '../storage.service';

type MeshMessageHandler = (fromPeerId: string, message: MeshMessage) => void;

export class MeshNode implements GossipTransport {
  private connections = new Map<string, WebRTCService>();
  private peerIdByService = new WeakMap<WebRTCService, string>();
  private messageHandlers: MeshMessageHandler[] = [];
  private gossip: MeshGossip;
  private reconnector: MeshReconnector;
  private initialized = false;

  /** Called when a new peer connection is fully established and identity exchanged. */
  onPeerConnected: ((peerId: string, chatService: ChatService) => void) | null = null;
  /** Called when a peer disconnects. */
  onPeerDisconnected: ((peerId: string) => void) | null = null;
  /** Called whenever the set of connected peers changes. */
  onConnectionsChanged: ((connectedPeerIds: string[]) => void) | null = null;
  /** Called when a chat message is received from any peer (already stored + acked). */
  onIncomingMessage: ((fromPeerId: string, message: Message) => void) | null = null;
  /** Called when a delivery ack is received for a sent message. */
  onDeliveryAck: ((fromPeerId: string, messageId: string) => void) | null = null;

  constructor() {
    // Gossip and reconnector will be set up in init()
    this.gossip = null!;
    this.reconnector = null!;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await MeshIdentity.init();

    const myPeerId = MeshIdentity.getPeerId();
    const myPubkey = await MeshIdentity.getPublicKeyBase64();

    this.gossip = new MeshGossip(this, myPeerId, myPubkey);
    this.reconnector = new MeshReconnector(this.gossip, {
      sendMeshMessage: (peerId, msg) => this.send(peerId, msg),
      onDirectConnection: (peerId, webrtc) => this.registerConnection(peerId, webrtc),
    });

    this.gossip.start();
    this.initialized = true;
  }

  getPeerId(): string {
    return MeshIdentity.getPeerId();
  }

  // ─── GossipTransport implementation ──────────────────────────────────

  send(peerId: string, message: MeshMessage): void {
    const webrtc = this.connections.get(peerId);
    if (webrtc) {
      webrtc.sendRaw(JSON.stringify({ t: 'mesh', payload: message }));
    }
  }

  onMessage(handler: MeshMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  // ─── Connection management ───────────────────────────────────────────

  /** Register an existing WebRTCService (from manual SDP exchange) and wire it into the mesh. */
  registerConnection(peerId: string, webrtc: WebRTCService): void {
    this.connections.set(peerId, webrtc);
    this.peerIdByService.set(webrtc, peerId);

    // Route mesh messages — uses the peerId bound at registration time,
    // so it keeps working even after the UI resets its own state.
    webrtc.onMeshMessage = (payload: unknown) => {
      this.handleMeshMessage(peerId, payload as MeshMessage);
    };

    // Handle ALL incoming chat messages at the transport layer:
    // always store to localStorage, always send ack, always notify.
    // This works whether the chat screen is open or not.
    webrtc.onChannelMessage = (data: string, msgId?: string) => {
      const id = msgId ?? crypto.randomUUID();
      const message: Message = { id, text: data, fromMe: false, timestamp: Date.now() };
      upsertContact(peerId);
      appendMessage(peerId, message);
      webrtc.sendAck(id);
      this.onIncomingMessage?.(peerId, message);
    };

    // Handle delivery acks
    webrtc.onAck = (id: string) => {
      this.onDeliveryAck?.(peerId, id);
    };

    // Wire close handler (chain with any existing handler, e.g. from ChatService)
    const existingOnClose = webrtc.onChannelClose;
    webrtc.onChannelClose = () => {
      existingOnClose?.();
      this.connections.delete(peerId);
      this.gossip.markDisconnected(peerId);
      this.onPeerDisconnected?.(peerId);
      this.onConnectionsChanged?.(this.getConnectedPeers());
    };

    this.onConnectionsChanged?.(this.getConnectedPeers());
  }

  /** Create a ChatService for a peer connection, preserving mesh handlers. */
  createChatService(peerId: string): ChatService | null {
    const webrtc = this.connections.get(peerId);
    if (!webrtc) return null;

    // Save the mesh close handler before ChatService overwrites it
    // (ChatService constructor sets onChannelClose for its onClose callback)
    const meshOnClose = webrtc.onChannelClose;
    const chat = new ChatService(webrtc);

    // Chain: ChatService close + mesh cleanup
    const chatOnClose = webrtc.onChannelClose;
    webrtc.onChannelClose = () => {
      chatOnClose?.();
      meshOnClose?.();
    };

    return chat;
  }

  /** Wire mesh protocol handling onto a WebRTCService. Call after identity exchange. */
  wireDataChannel(webrtc: WebRTCService, peerId: string, pubkey: string): void {
    this.registerConnection(peerId, webrtc);
    this.gossip.upsertPeer(peerId, pubkey);
  }

  /** Handle an incoming data channel message that has t:'mesh'. */
  handleMeshMessage(fromPeerId: string, payload: MeshMessage): void {
    // Route to gossip
    for (const handler of this.messageHandlers) {
      handler(fromPeerId, payload);
    }

    // Route reconnect-related messages to reconnector
    if (
      payload.type === 'RECONNECT_REQUEST' ||
      payload.type === 'RECONNECT_ACCEPTED' ||
      payload.type === 'RECONNECT_REJECTED' ||
      payload.type === 'RELAY_OFFER' ||
      payload.type === 'RELAY_ANSWER' ||
      payload.type === 'RELAY_ICE'
    ) {
      this.reconnector.handleMessage(fromPeerId, payload);
    }
  }

  /** Attempt auto-reconnection to a target peer via relay. */
  async reconnectToPeer(targetPeerId: string): Promise<void> {
    return this.reconnector.reconnect(targetPeerId);
  }

  /** Get all known peers from the gossip registry. */
  getKnownPeers() {
    return this.gossip.getAllRecords();
  }

  getOnlinePeers() {
    return this.gossip.getOnlinePeers();
  }

  isConnected(peerId: string): boolean {
    return this.connections.has(peerId);
  }

  dispose(): void {
    this.gossip.stop();
    this.reconnector.dispose();
    for (const webrtc of this.connections.values()) {
      webrtc.close();
    }
    this.connections.clear();
  }
}
