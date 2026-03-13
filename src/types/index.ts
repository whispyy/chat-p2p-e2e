export type ConnectionState =
  | 'idle'
  | 'gathering'
  | 'awaiting_answer'
  | 'joining'
  | 'generating_answer'
  | 'has_answer'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type MessagePosition = 'solo' | 'first' | 'middle' | 'last';

export interface Contact {
  id: string;         // peer's persistent UUID
  name: string;       // display name (defaults to short ID)
  lastSeen: number;   // timestamp of last activity
  lastMessage: { text: string; fromMe: boolean } | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  delivered?: boolean;
  /** Present for image messages. url is '' while the transfer is in progress. */
  image?: {
    url: string;
    mimeType: string;
    progress?: number; // 0–100 while receiving; absent when complete
  };
}

export interface ChatServiceEvents {
  onMessage: ((message: Message) => void) | null;
  onMessageUpdate: ((id: string, updater: (prev: Message) => Message) => void) | null;
  onClose: (() => void) | null;
}

export type CallState = 'idle' | 'outgoing_ringing' | 'incoming_ringing' | 'negotiating' | 'active';

export interface CallSignalMessage {
  t: 'call-request' | 'call-accept' | 'call-reject' | 'call-offer' | 'call-answer' | 'call-end';
  callId: string;
  sdp?: string;
  reason?: string;
}
