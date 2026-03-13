export type ConnectionState =
  | 'idle'
  | 'gathering'
  | 'awaiting_answer'
  | 'joining'
  | 'generating_answer'
  | 'has_answer'
  | 'connected'
  | 'error';

export type MessagePosition = 'solo' | 'first' | 'middle' | 'last';

export interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
}

export interface ChatServiceEvents {
  onMessage: (message: Message) => void;
  onClose: () => void;
}
