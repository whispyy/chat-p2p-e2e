import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatService } from '../services/chat.service';
import type { Message } from '../types';
import { getMessages, appendMessage } from '../services/storage.service';

export function useChat(
  chatService: ChatService | null,
  onDisconnect?: () => void,
  contactId?: string,
) {
  // Pre-load stored history when we know who we're talking to.
  // contactId starts as undefined (identity exchange is async) so the lazy
  // initializer often runs before we know the peer — handle that below.
  const [messages, setMessages] = useState<Message[]>(() =>
    contactId ? getMessages(contactId) : []
  );

  // When contactId first becomes available (after identity handshake),
  // prepend stored history to any messages already in state.
  const historyLoaded = useRef(!!contactId);
  useEffect(() => {
    if (contactId && !historyLoaded.current) {
      historyLoaded.current = true;
      const stored = getMessages(contactId);
      const storedIds = new Set(stored.map((m) => m.id));
      setMessages((prev) => [...stored, ...prev.filter((m) => !storedIds.has(m.id))]);
    }
  }, [contactId]);

  useEffect(() => {
    if (!chatService) return;

    chatService.onMessage = (message) => {
      // Only update React state — storage is handled by MeshNode at the transport layer
      setMessages((prev) => [...prev, message]);
    };
    chatService.onClose = () => {
      onDisconnect?.();
    };
    chatService.onDelivered = (id) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, delivered: true } : m)),
      );
    };

    return () => {
      chatService.onMessage = null;
      chatService.onClose = null;
      chatService.onDelivered = null;
    };
  }, [chatService, onDisconnect, contactId]);

  const send = useCallback(
    (text: string) => {
      if (!chatService) return;
      const message = chatService.send(text);
      setMessages((prev) => [...prev, message]);
      // Store outgoing messages (incoming are stored by MeshNode)
      if (contactId) appendMessage(contactId, message);
    },
    [chatService, contactId],
  );

  return { messages, send };
}
