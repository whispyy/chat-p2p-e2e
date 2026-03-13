import type { CallSignalMessage } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CHUNK_SIZE = 64 * 1024; // 64 KB — well within the 256 KB DataChannel limit
const BUFFER_HIGH = 1024 * 1024; // pause sending above 1 MB buffered
const BUFFER_LOW  =  512 * 1024; // resume once back below 512 KB

interface IncomingFile {
  mimeType: string;
  totalChunks: number;
  receivedChunks: number;
  chunks: Array<string | null>;
}

export class WebRTCService {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private incomingFiles = new Map<string, IncomingFile>();

  onChannelOpen:       (() => void) | null = null;
  onChannelMessage:    ((data: string, id?: string) => void) | null = null;
  onChannelClose:      (() => void) | null = null;
  onPeerIdentity:      ((id: string, pubkey?: string, sig?: string) => void) | null = null;
  onMeshMessage:       ((payload: unknown) => void) | null = null;
  onAck:               ((id: string) => void) | null = null;
  onCallSignal:        ((msg: CallSignalMessage) => void) | null = null;
  onTrack:             ((event: RTCTrackEvent) => void) | null = null;
  onNegotiationNeeded: (() => void) | null = null;

  onIncomingFileStart:    ((fileId: string, mimeType: string, totalChunks: number) => void) | null = null;
  onIncomingFileProgress: ((fileId: string, received: number, total: number) => void) | null = null;
  onIncomingFileComplete: ((fileId: string, blob: Blob) => void) | null = null;

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

  // ─── File transfer ─────────────────────────────────────────────────────

  async sendFile(file: File, onProgress?: (pct: number) => void): Promise<void> {
    if (this.channel?.readyState !== 'open') return;

    const fileId = crypto.randomUUID();
    const buffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

    this.channel.send(JSON.stringify({
      t: 'file-start', fileId, mimeType: file.type, totalChunks,
    }));

    for (let i = 0; i < totalChunks; i++) {
      // Flow control: pause if the send buffer is getting full
      if (this.channel.bufferedAmount > BUFFER_HIGH) {
        await new Promise<void>((resolve) => {
          this.channel!.bufferedAmountLowThreshold = BUFFER_LOW;
          this.channel!.onbufferedamountlow = () => {
            this.channel!.onbufferedamountlow = null; // clear after resolving
            resolve();
          };
        });
      }

      const slice = buffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const uint8 = new Uint8Array(slice);
      // apply() is O(n) vs the O(n²) string concatenation loop; safe for 64 KB chunks
      const binary = String.fromCharCode.apply(null, uint8 as unknown as number[]);

      this.channel.send(JSON.stringify({ t: 'file-chunk', fileId, index: i, data: btoa(binary) }));
      onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    }

    this.channel.send(JSON.stringify({ t: 'file-end', fileId }));
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  close(): void {
    this.onChannelOpen = null;
    this.onChannelMessage = null;
    this.onChannelClose = null;
    this.onPeerIdentity = null;
    this.onMeshMessage = null;
    this.onAck = null;
    this.onCallSignal = null;
    this.onTrack = null;
    this.onNegotiationNeeded = null;
    this.onIncomingFileStart = null;
    this.onIncomingFileProgress = null;
    this.onIncomingFileComplete = null;
    this.incomingFiles.clear();
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
    channel.onopen  = () => this.onChannelOpen?.();
    channel.onclose = () => this.onChannelClose?.();

    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.t === 'msg')  { this.onChannelMessage?.(msg.text, msg.id); return; }
        if (msg.t === 'id')   { this.onPeerIdentity?.(msg.id, msg.pubkey, msg.sig); return; }
        if (msg.t === 'mesh') { this.onMeshMessage?.(msg.payload); return; }
        if (msg.t === 'ack')  { this.onAck?.(msg.id); return; }
        if (msg.t?.startsWith('call-')) { this.onCallSignal?.(msg as CallSignalMessage); return; }

        if (msg.t === 'file-start') {
          this.incomingFiles.set(msg.fileId, {
            mimeType: msg.mimeType,
            totalChunks: msg.totalChunks,
            receivedChunks: 0,
            chunks: new Array(msg.totalChunks).fill(null),
          });
          this.onIncomingFileStart?.(msg.fileId, msg.mimeType, msg.totalChunks);
          return;
        }

        if (msg.t === 'file-chunk') {
          const f = this.incomingFiles.get(msg.fileId);
          if (f) {
            f.chunks[msg.index] = msg.data;
            f.receivedChunks += 1;
            this.onIncomingFileProgress?.(msg.fileId, f.receivedChunks, f.totalChunks);
          }
          return;
        }

        if (msg.t === 'file-end') {
          const f = this.incomingFiles.get(msg.fileId);
          if (f) {
            // Bail if any chunk never arrived — avoids atob(null) throw and frozen progress bubble
            if (f.chunks.some((c) => c === null)) {
              this.incomingFiles.delete(msg.fileId);
              return;
            }
            const binaryChunks = (f.chunks as string[]).map((chunk) =>
              Uint8Array.from(atob(chunk), (c) => c.charCodeAt(0))
            );
            const blob = new Blob(binaryChunks, { type: f.mimeType });
            this.incomingFiles.delete(msg.fileId);
            this.onIncomingFileComplete?.(msg.fileId, blob);
          }
          return;
        }
      } catch {
        // fallback: treat as raw text
        this.onChannelMessage?.(e.data);
      }
    };
  }
}
