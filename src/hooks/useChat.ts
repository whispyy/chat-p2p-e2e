import { useCallback, useEffect, useState } from 'react';
import { ChatService } from '../services/chat.service';
import type { Message } from '../types';

export function useChat(chatService: ChatService | null, onDisconnect?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatService) return;

    chatService.onMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };
    chatService.onClose = () => {
      onDisconnect?.();
    };

    return () => {
      chatService.onMessage = null;
      chatService.onClose = null;
    };
  }, [chatService, onDisconnect]);

  const send = useCallback(
    (text: string) => {
      if (!chatService) return;
      const message = chatService.send(text);
      setMessages((prev) => [...prev, message]);
    },
    [chatService]
  );

  return { messages, send };
}
