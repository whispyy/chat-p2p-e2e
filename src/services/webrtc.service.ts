import type { CallSignalMessage } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCService {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  onChannelOpen: (() => void) | null = null;
  onChannelMessage: ((data: string, id?: string) => void) | null = null;
  onChannelClose: (() => void) | null = null;
  onPeerIdentity: ((id: string, pubkey?: string, sig?: string) => void) | null = null;
  onMeshMessage: ((payload: unknown) => void) | null = null;
  onAck: ((id: string) => void) | null = null;
  onCallSignal: ((msg: CallSignalMessage) => void) | null = null;
  onTrack: ((event: RTCTrackEvent) => void) | null = null;
  onNegotiationNeeded: (() => void) | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ontrack = (e) => this.onTrack?.(e);
    this.pc.onnegotiationneeded = () => this.onNegotiationNeeded?.();
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.channel = this.pc.createDataChannel('chat');
    this.bindChannelEvents(this.channel);

    const gathered = this.waitForIceGathering();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await gathered;

    return this.pc.localDescription!;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.pc.ondatachannel = (event) => {
      this.channel = event.channel;
      this.bindChannelEvents(this.channel);
    };

    const gathered = this.waitForIceGathering();
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await gathered;

    return this.pc.localDescription!;
  }

  async submitAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
  }

  // ─── Chat messaging ────────────────────────────────────────────────────

  send(id: string, text: string): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify({ t: 'msg', id, text }));
    }
  }

  sendAck(id: string): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify({ t: 'ack', id }));
    }
  }

  sendIdentity(id: string, pubkey?: string, sig?: string): void {
    if (this.channel?.readyState === 'open') {
      const msg: Record<string, string> = { t: 'id', id };
      if (pubkey) msg.pubkey = pubkey;
      if (sig) msg.sig = sig;
      this.channel.send(JSON.stringify(msg));
    }
  }

  sendRaw(data: string): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(data);
    }
  }

  // ─── Call signaling ────────────────────────────────────────────────────

  sendCallSignal(msg: CallSignalMessage): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify(msg));
    }
  }

  // ─── Audio track management ────────────────────────────────────────────

  addAudioTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    return this.pc.addTrack(track, stream);
  }

  removeAudioTrack(sender: RTCRtpSender): void {
    this.pc.removeTrack(sender);
  }

  async createRenegotiationOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription!;
  }

  async acceptRenegotiationOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!;
  }

  async acceptRenegotiationAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
  }

  async rollbackLocalDescription(): Promise<void> {
    await this.pc.setLocalDescription({ type: 'rollback' });
  }

  getSignalingState(): RTCSignalingState {
    return this.pc.signalingState;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  close(): void {
    this.onChannelOpen = null;
    this.onChannelMessage = null;
    this.onChannelClose = null;
    this.onPeerIdentity = null;
    this.onCallSignal = null;
    this.onTrack = null;
    this.onNegotiationNeeded = null;
    this.channel?.close();
    this.pc.close();
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      this.pc.onicegatheringstatechange = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.onicegatheringstatechange = null;
          resolve();
        }
      };
    });
  }

  private bindChannelEvents(channel: RTCDataChannel): void {
    channel.onopen = () => this.onChannelOpen?.();
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.t === 'msg') this.onChannelMessage?.(msg.text, msg.id);
        if (msg.t === 'id')  this.onPeerIdentity?.(msg.id, msg.pubkey, msg.sig);
        if (msg.t === 'mesh') this.onMeshMessage?.(msg.payload);
        if (msg.t === 'ack') this.onAck?.(msg.id);
        if (msg.t?.startsWith('call-')) this.onCallSignal?.(msg as CallSignalMessage);
      } catch {
        // fallback: treat as raw text
        this.onChannelMessage?.(e.data);
      }
    };
    channel.onclose = () => this.onChannelClose?.();
  }
}
