import type { MeshMessage } from './gossip-transport';
import type { MeshGossip } from './mesh-gossip';
import * as MeshIdentity from './mesh-identity';
import { WebRTCService } from '../webrtc.service';
import { encodeSignal, decodeSignal } from '../../utils/encoding';

export interface ReconnectCallbacks {
  sendMeshMessage: (peerId: string, msg: MeshMessage) => void;
  onDirectConnection: (targetPeerId: string, webrtc: WebRTCService) => void;
}

export class MeshReconnector {
  private gossip: MeshGossip;
  private callbacks: ReconnectCallbacks;
  private pendingReconnects = new Map<string, WebRTCService>();

  constructor(gossip: MeshGossip, callbacks: ReconnectCallbacks) {
    this.gossip = gossip;
    this.callbacks = callbacks;
  }

  /** Initiate reconnection to a target peer through any available relay. */
  async reconnect(targetPeerId: string): Promise<void> {
    const candidates = this.gossip.getCachedPeersForReconnect()
      .filter((r) => r.peerId !== targetPeerId);

    if (candidates.length === 0) {
      throw new Error('No relay peers available for reconnection');
    }

    // Try each candidate as a relay
    const myPeerId = MeshIdentity.getPeerId();
    const timestamp = Date.now();
    const challengeData = `${timestamp}:${targetPeerId}`;
    const challenge = await MeshIdentity.sign(challengeData);
    const pubkey = await MeshIdentity.getPublicKeyBase64();

    for (const candidate of candidates) {
      this.callbacks.sendMeshMessage(candidate.peerId, {
        type: 'RECONNECT_REQUEST',
        peerId: myPeerId,
        targetPeerId,
        pubkey,
        challenge,
        timestamp,
      });
    }
  }

  /** Handle relay signaling messages. */
  async handleMessage(fromPeerId: string, msg: MeshMessage): Promise<void> {
    switch (msg.type) {
      case 'RECONNECT_REQUEST':
        await this.handleReconnectRequest(fromPeerId, msg);
        break;
      case 'RECONNECT_ACCEPTED':
        // Relay accepted — now wait for the RELAY_OFFER/RELAY_ANSWER flow
        break;
      case 'RELAY_OFFER':
        await this.handleRelayOffer(msg);
        break;
      case 'RELAY_ANSWER':
        await this.handleRelayAnswer(msg);
        break;
      case 'RELAY_ICE':
        // ICE candidates are handled via the full SDP exchange (trickle not used)
        break;
    }
  }

  /** As a relay: receive reconnect request and forward to target if connected. */
  private async handleReconnectRequest(
    fromPeerId: string,
    msg: Extract<MeshMessage, { type: 'RECONNECT_REQUEST' }>,
  ): Promise<void> {
    // Verify the requester's identity
    const record = this.gossip.getRecord(msg.peerId);
    const pubkey = record?.pubkey ?? msg.pubkey;
    const challengeData = `${msg.timestamp}:${msg.targetPeerId}`;

    const valid = await MeshIdentity.verify(pubkey, challengeData, msg.challenge);
    if (!valid) {
      this.callbacks.sendMeshMessage(fromPeerId, {
        type: 'RECONNECT_REJECTED',
        reason: 'Invalid challenge signature',
      });
      return;
    }

    // Check if target is connected to us
    const myPeerId = MeshIdentity.getPeerId();
    if (msg.targetPeerId === myPeerId) {
      // We ARE the target — create a direct connection back
      this.callbacks.sendMeshMessage(fromPeerId, {
        type: 'RECONNECT_ACCEPTED',
        peerId: myPeerId,
      });
      await this.createAnswerForRelay(fromPeerId, msg.peerId);
      return;
    }

    // Forward to target if we know them
    this.callbacks.sendMeshMessage(fromPeerId, {
      type: 'RECONNECT_ACCEPTED',
      peerId: myPeerId,
    });

    // Bridge: forward future RELAY_OFFER/RELAY_ANSWER between the two peers
    // (handled by MeshNode routing)
    this.callbacks.sendMeshMessage(msg.targetPeerId, {
      type: 'RECONNECT_REQUEST',
      peerId: msg.peerId,
      targetPeerId: msg.targetPeerId,
      pubkey: msg.pubkey,
      challenge: msg.challenge,
      timestamp: msg.timestamp,
    });
  }

  /** When we are the target of a reconnect: create an offer and send it back via relay. */
  private async createAnswerForRelay(relayPeerId: string, requesterPeerId: string): Promise<void> {
    const webrtc = new WebRTCService();
    this.pendingReconnects.set(requesterPeerId, webrtc);

    const offer = await webrtc.createOffer();
    this.callbacks.sendMeshMessage(relayPeerId, {
      type: 'RELAY_OFFER',
      fromPeerId: MeshIdentity.getPeerId(),
      targetPeerId: requesterPeerId,
      offer: encodeSignal(offer),
    });
  }

  /** Handle a relayed offer — create answer and send back. */
  private async handleRelayOffer(msg: Extract<MeshMessage, { type: 'RELAY_OFFER' }>): Promise<void> {
    const myPeerId = MeshIdentity.getPeerId();
    if (msg.targetPeerId !== myPeerId) {
      // Forward to the actual target
      this.callbacks.sendMeshMessage(msg.targetPeerId, msg);
      return;
    }

    const webrtc = new WebRTCService();
    this.pendingReconnects.set(msg.fromPeerId, webrtc);

    const offer = decodeSignal(msg.offer);
    const answer = await webrtc.createAnswer(offer);

    // Set up the connection callback
    webrtc.onChannelOpen = () => {
      this.callbacks.onDirectConnection(msg.fromPeerId, webrtc);
      this.pendingReconnects.delete(msg.fromPeerId);
    };

    this.callbacks.sendMeshMessage(msg.fromPeerId, {
      type: 'RELAY_ANSWER',
      fromPeerId: myPeerId,
      targetPeerId: msg.fromPeerId,
      answer: encodeSignal(answer),
    });
  }

  /** Handle a relayed answer — complete the connection. */
  private async handleRelayAnswer(msg: Extract<MeshMessage, { type: 'RELAY_ANSWER' }>): Promise<void> {
    const myPeerId = MeshIdentity.getPeerId();
    if (msg.targetPeerId !== myPeerId) {
      // Forward to the actual target
      this.callbacks.sendMeshMessage(msg.targetPeerId, msg);
      return;
    }

    const webrtc = this.pendingReconnects.get(msg.fromPeerId);
    if (!webrtc) return;

    webrtc.onChannelOpen = () => {
      this.callbacks.onDirectConnection(msg.fromPeerId, webrtc);
      this.pendingReconnects.delete(msg.fromPeerId);
    };

    const answer = decodeSignal(msg.answer);
    await webrtc.submitAnswer(answer);
  }

  dispose(): void {
    for (const webrtc of this.pendingReconnects.values()) {
      webrtc.close();
    }
    this.pendingReconnects.clear();
  }
}
