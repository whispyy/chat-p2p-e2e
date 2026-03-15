import type { Message } from '../types';
import { WebRTCService } from './webrtc.service';

export class ChatService {
  private webrtc: WebRTCService;

  /** Set by useChat for live UI updates when the chat screen is open. */
  onMessage: ((message: Message) => void) | null = null;
  onClose: (() => void) | null = null;
  onDelivered: ((id: string) => void) | null = null;

  constructor(webrtc: WebRTCService) {
    this.webrtc = webrtc;
    // NOTE: onChannelMessage and onAck are NOT set here.
    // MeshNode handles all incoming messages at the transport layer
    // (storage + ack), then forwards to ChatService.onMessage for UI.
    this.webrtc.onChannelClose = () => this.onClose?.();
  }

  send(text: string): Message {
    const id = crypto.randomUUID();
    this.webrtc.send(id, text);
    return {
      id,
      text,
      fromMe: true,
      timestamp: Date.now(),
      delivered: false,
    };
  }
}
