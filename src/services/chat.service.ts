import type { Message } from '../types';
import { WebRTCService } from './webrtc.service';

export class ChatService {
  private webrtc: WebRTCService;
  onMessage: ((message: Message) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(webrtc: WebRTCService) {
    this.webrtc = webrtc;

    this.webrtc.onChannelMessage = (data) => {
      this.onMessage?.({
        id: crypto.randomUUID(),
        text: data,
        fromMe: false,
        timestamp: Date.now(),
      });
    };

    this.webrtc.onChannelClose = () => this.onClose?.();
  }

  send(text: string): Message {
    this.webrtc.send(text);
    return {
      id: crypto.randomUUID(),
      text,
      fromMe: true,
      timestamp: Date.now(),
    };
  }
}
