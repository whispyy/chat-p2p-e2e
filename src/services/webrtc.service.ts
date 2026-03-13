const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCService {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  onChannelOpen: (() => void) | null = null;
  onChannelMessage: ((data: string) => void) | null = null;
  onChannelClose: (() => void) | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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

  send(message: string): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(message);
    }
  }

  close(): void {
    this.onChannelOpen = null;
    this.onChannelMessage = null;
    this.onChannelClose = null;
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
    channel.onmessage = (e) => this.onChannelMessage?.(e.data);
    channel.onclose = () => this.onChannelClose?.();
  }
}
