import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatService } from '../services/chat.service';
import type { Message } from '../types';
import { getMessages, appendMessage } from '../services/storage.service';

export function useChat(
  chatService: ChatService | null,
  onDisconnect?: () => void,
  contactId?: string,
) {
  const [messages, setMessages] = useState<Message[]>(() =>
    contactId ? getMessages(contactId) : []
  );

  // contactId arrives asynchronously (after identity handshake).
  // If it wasn't set at mount, load stored history once it becomes available.
  // Keep a ref to the latest messages so cleanup can revoke image blob URLs on session end
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

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

    chatService.onMessageUpdate = (id, updater) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
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
      chatService.onMessageUpdate = null;
      chatService.onClose = null;
      chatService.onDelivered = null;
      // Revoke all image blob URLs now that the session is over
      messagesRef.current.forEach((m) => {
        if (m.image?.url) URL.revokeObjectURL(m.image.url);
      });
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

  const sendImage = useCallback(
    (file: File) => {
      if (!chatService) return;
      chatService.sendImage(file).then((message) => {
        setMessages((prev) => [...prev, message]);
        // image messages intentionally not persisted
      });
    },
    [chatService],
  );

  return { messages, send, sendImage };
}
