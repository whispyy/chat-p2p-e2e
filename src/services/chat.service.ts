import type { Message } from '../types';
import { WebRTCService } from './webrtc.service';

export class ChatService {
  private webrtc: WebRTCService;
  /** fileId → messageId, used to route progress/complete events to the right message */
  private fileMessageIds = new Map<string, string>();

  /** Set by useChat for live UI updates when the chat screen is open. */
  onMessage:       ((message: Message) => void) | null = null;
  onMessageUpdate: ((id: string, updater: (prev: Message) => Message) => void) | null = null;
  onClose:         (() => void) | null = null;
  onDelivered:     ((id: string) => void) | null = null;

  constructor(webrtc: WebRTCService) {
    this.webrtc = webrtc;
    // NOTE: onChannelMessage and onAck are NOT set here.
    // MeshNode handles all incoming messages at the transport layer
    // (storage + ack), then forwards to ChatService.onMessage for UI.
    this.webrtc.onChannelClose = () => this.onClose?.();

    this.webrtc.onIncomingFileStart = (fileId, mimeType) => {
      const messageId = crypto.randomUUID();
      this.fileMessageIds.set(fileId, messageId);
      this.onMessage?.({
        id: messageId,
        text: '',
        fromMe: false,
        timestamp: Date.now(),
        image: { url: '', mimeType, progress: 0 },
      });
    };

    this.webrtc.onIncomingFileProgress = (fileId, received, total) => {
      const messageId = this.fileMessageIds.get(fileId);
      if (!messageId) return;
      const progress = Math.round((received / total) * 100);
      this.onMessageUpdate?.(messageId, (prev) => ({
        ...prev,
        image: { ...prev.image!, progress },
      }));
    };

    this.webrtc.onIncomingFileComplete = (fileId, blob) => {
      const messageId = this.fileMessageIds.get(fileId);
      if (!messageId) return;
      this.fileMessageIds.delete(fileId);
      const url = URL.createObjectURL(blob);
      this.onMessageUpdate?.(messageId, (prev) => ({
        ...prev,
        image: { ...prev.image!, url, progress: undefined },
      }));
    };
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

  async sendImage(file: File): Promise<Message> {
    const url = URL.createObjectURL(file);
    const message: Message = {
      id: crypto.randomUUID(),
      text: '',
      fromMe: true,
      timestamp: Date.now(),
      image: { url, mimeType: file.type },
    };
    // Fire and forget — sender sees the image immediately; send happens in background
    this.webrtc.sendFile(file).catch(() => {
      // transfer failed — could mark message as failed in a future iteration
    });
    return message;
  }
}
