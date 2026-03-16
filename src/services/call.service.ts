import type { CallState, CallSignalMessage } from '../types';
import { WebRTCService } from './webrtc.service';

const RING_TIMEOUT = 30_000;

export class CallService {
  private webrtc: WebRTCService;
  private myPeerId: string;
  private remotePeerId: string;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioSender: RTCRtpSender | null = null;
  private callId: string | null = null;
  private state: CallState = 'idle';
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private makingOffer = false;

  onStateChange: ((state: CallState, remotePeerId: string) => void) | null = null;
  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  constructor(webrtc: WebRTCService, myPeerId: string, remotePeerId: string) {
    this.webrtc = webrtc;
    this.myPeerId = myPeerId;
    this.remotePeerId = remotePeerId;
  }

  getState(): CallState {
    return this.state;
  }

  getCallId(): string | null {
    return this.callId;
  }

  /** Polite peer = lexicographically greater peerId. Polite peer yields on glare. */
  private get isPolite(): boolean {
    return this.myPeerId > this.remotePeerId;
  }

  // ─── Outgoing call ─────────────────────────────────────────────────────

  startCall(): void {
    if (this.state !== 'idle') return;
    this.callId = crypto.randomUUID();
    this.setState('outgoing_ringing');
    this.webrtc.sendCallSignal({ t: 'call-request', callId: this.callId });
    this.ringTimer = setTimeout(() => {
      if (this.state === 'outgoing_ringing') {
        this.webrtc.sendCallSignal({ t: 'call-end', callId: this.callId! });
        this.cleanup();
        this.onError?.('No answer');
      }
    }, RING_TIMEOUT);
  }

  cancelCall(): void {
    if (this.state === 'outgoing_ringing' || this.state === 'negotiating') {
      this.webrtc.sendCallSignal({ t: 'call-end', callId: this.callId! });
      this.cleanup();
    }
  }

  // ─── Incoming call ─────────────────────────────────────────────────────

  receiveCallRequest(callId: string): void {
    if (this.state !== 'idle') {
      // Busy — reject
      this.webrtc.sendCallSignal({ t: 'call-reject', callId, reason: 'busy' });
      return;
    }
    this.callId = callId;
    this.setState('incoming_ringing');
    this.ringTimer = setTimeout(() => {
      if (this.state === 'incoming_ringing') {
        this.cleanup();
      }
    }, RING_TIMEOUT);
  }

  async acceptCall(): Promise<void> {
    if (this.state !== 'incoming_ringing' || !this.callId) return;
    this.webrtc.sendCallSignal({ t: 'call-accept', callId: this.callId });
    await this.startNegotiation();
  }

  rejectCall(): void {
    if (this.state !== 'incoming_ringing' || !this.callId) return;
    this.webrtc.sendCallSignal({ t: 'call-reject', callId: this.callId });
    this.cleanup();
  }

  // ─── Active call ───────────────────────────────────────────────────────

  hangUp(): void {
    if (this.state === 'idle') return;
    if (this.callId) {
      this.webrtc.sendCallSignal({ t: 'call-end', callId: this.callId });
    }
    this.cleanup();
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled; // return true if muted
  }

  // ─── Signal handler ────────────────────────────────────────────────────

  handleCallSignal(msg: CallSignalMessage): void {
    switch (msg.t) {
      case 'call-request':
        this.receiveCallRequest(msg.callId);
        break;

      case 'call-accept':
        if (this.state === 'outgoing_ringing' && msg.callId === this.callId) {
          this.startNegotiation();
        }
        break;

      case 'call-reject':
        if (this.state === 'outgoing_ringing' && msg.callId === this.callId) {
          this.cleanup();
          this.onError?.(msg.reason === 'busy' ? 'Peer is busy' : 'Call declined');
        }
        break;

      case 'call-offer':
        if (msg.callId === this.callId) {
          this.handleCallOffer(msg.sdp!);
        }
        break;

      case 'call-answer':
        if (msg.callId === this.callId) {
          this.handleCallAnswer(msg.sdp!);
        }
        break;

      case 'call-end':
        if (msg.callId === this.callId || this.state !== 'idle') {
          this.cleanup();
        }
        break;
    }
  }

  // ─── Private: negotiation ──────────────────────────────────────────────

  private async startNegotiation(): Promise<void> {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    this.setState('negotiating');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Could not access microphone';
      this.webrtc.sendCallSignal({ t: 'call-end', callId: this.callId!, reason: 'media-denied' });
      this.cleanup();
      this.onError?.(msg);
      return;
    }

    const track = this.localStream.getAudioTracks()[0];
    this.audioSender = this.webrtc.addAudioTrack(track, this.localStream);

    // Wire remote track
    this.webrtc.onTrack = (event) => {
      this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream?.(this.remoteStream);
      if (this.state === 'negotiating') {
        this.setState('active');
      }
    };

    // Wire negotiation needed for polite/impolite pattern
    this.webrtc.onNegotiationNeeded = async () => {
      try {
        this.makingOffer = true;
        const offer = await this.webrtc.createRenegotiationOffer();
        this.webrtc.sendCallSignal({
          t: 'call-offer',
          callId: this.callId!,
          sdp: JSON.stringify(offer),
        });
      } catch {
        // Renegotiation failed — may be resolved by polite/impolite
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private async handleCallOffer(sdpStr: string): Promise<void> {
    const offer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
    const signalingState = this.webrtc.getSignalingState();
    const offerCollision = this.makingOffer || signalingState !== 'stable';

    if (offerCollision) {
      if (!this.isPolite) {
        // Impolite: ignore their offer, ours takes priority
        return;
      }
      // Polite: rollback our offer and accept theirs
      await this.webrtc.rollbackLocalDescription();
    }

    const answer = await this.webrtc.acceptRenegotiationOffer(offer);
    this.webrtc.sendCallSignal({
      t: 'call-answer',
      callId: this.callId!,
      sdp: JSON.stringify(answer),
    });
  }

  private async handleCallAnswer(sdpStr: string): Promise<void> {
    const answer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
    await this.webrtc.acceptRenegotiationAnswer(answer);
    // Audio should now flow — state transitions to active when onTrack fires
    // If onTrack already fired (can happen), transition now
    if (this.remoteStream && this.state === 'negotiating') {
      this.setState('active');
    }
  }

  private setState(state: CallState): void {
    this.state = state;
    this.onStateChange?.(state, this.remotePeerId);
  }

  private cleanup(): void {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    if (this.audioSender) {
      this.webrtc.removeAudioTrack(this.audioSender);
      this.audioSender = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.webrtc.onTrack = null;
    this.webrtc.onNegotiationNeeded = null;
    this.callId = null;
    this.makingOffer = false;
    this.setState('idle');
  }

  dispose(): void {
    this.hangUp();
    this.onStateChange = null;
    this.onRemoteStream = null;
    this.onError = null;
  }
}
