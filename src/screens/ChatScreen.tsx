import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Message } from '../components/Message';
import { MessageInput } from '../components/MessageInput';
import { ActiveCallBar } from '../components/ActiveCallBar';
import { useChat } from '../hooks/useChat';
import { ChatService } from '../services/chat.service';
import type { CallState, Message as MessageType, MessagePosition } from '../types';

function getPosition(messages: MessageType[], index: number): MessagePosition {
  const cur = messages[index];
  const prev = messages[index - 1];
  const next = messages[index + 1];
  const sameAsPrev = prev?.fromMe === cur.fromMe;
  const sameAsNext = next?.fromMe === cur.fromMe;
  if (!sameAsPrev && !sameAsNext) return 'solo';
  if (!sameAsPrev && sameAsNext)  return 'first';
  if (sameAsPrev && sameAsNext)   return 'middle';
  return 'last';
}

interface ChatScreenProps {
  chatService: ChatService;
  peerId: string;
  onEnd: () => void;
  isOnline?: boolean;
  callState?: CallState;
  callDuration?: number;
  isMuted?: boolean;
  onStartCall?: () => void;
  onHangUp?: () => void;
  onToggleMute?: () => void;
}

export function ChatScreen({ chatService, peerId, onEnd, isOnline, callState, callDuration, isMuted, onStartCall, onHangUp, onToggleMute }: ChatScreenProps) {
  const { messages, send, sendImage } = useChat(chatService, onEnd, peerId || undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Container>
      <Header>
        <EndButton onClick={onEnd} aria-label="End chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </EndButton>

        <HeaderCenter>
          <Avatar>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.48 0 4.5-2.02 4.5-4.5S14.48 3 12 3 7.5 5.02 7.5 7.5 9.52 12 12 12zm0 2.25c-3.01 0-9 1.51-9 4.5V21h18v-2.25c0-2.99-5.99-4.5-9-4.5z" />
            </svg>
          </Avatar>
          <HeaderText>
            <HeaderTitle>Secure Chat</HeaderTitle>
            <HeaderSub>
              {isOnline && <StatusDot />}
              <LockIcon />
              {isOnline ? 'Online · E2E encrypted' : 'End-to-end encrypted · Direct'}
            </HeaderSub>
          </HeaderText>
        </HeaderCenter>

        <CallButton
          onClick={onStartCall}
          disabled={!isOnline || !onStartCall || (callState !== undefined && callState !== 'idle')}
          aria-label="Start call"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
          </svg>
        </CallButton>
      </Header>

      {callState === 'active' && onHangUp && onToggleMute && (
        <ActiveCallBar
          duration={callDuration ?? 0}
          isMuted={isMuted ?? false}
          onToggleMute={onToggleMute}
          onHangUp={onHangUp}
        />
      )}

      {callState === 'outgoing_ringing' && (
        <RingingBar>
          Calling...
          <RingingHangUp onClick={onHangUp}>Cancel</RingingHangUp>
        </RingingBar>
      )}

      <MessageList>
        {messages.length === 0 ? (
          <EmptyState>
            <EmptyLock>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </EmptyLock>
            <EmptyTitle>Connected & Encrypted</EmptyTitle>
            <EmptyHint>Messages are end-to-end encrypted and never stored on any server.</EmptyHint>
          </EmptyState>
        ) : (
          messages.map((m, i) => (
            <Message key={m.id} message={m} position={getPosition(messages, i)} />
          ))
        )}
        <div ref={bottomRef} />
      </MessageList>

      <MessageInput onSend={send} onSendImage={sendImage} />
    </Container>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: max(14px, env(safe-area-inset-top)) 16px 14px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
`;

const EndButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: #555;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:active {
    background: rgba(0, 0, 0, 0.12);
  }
`;

const HeaderCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
`;

const Avatar = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e8edf7;
  color: #4f8ef7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111;
  line-height: 1.2;
`;

const HeaderSub = styled.span`
  font-size: 11px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 3px;
`;

const StatusDot = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34c759;
  flex-shrink: 0;
`;

const CallButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: #34c759;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, opacity 0.15s;

  &:active { background: rgba(0, 0, 0, 0.12); }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const RingingBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #f0f8ff;
  border-bottom: 1px solid rgba(79, 142, 247, 0.15);
  font-size: 14px;
  font-weight: 500;
  color: #4f8ef7;
  flex-shrink: 0;
`;

const RingingHangUp = styled.button`
  border: none;
  background: none;
  color: #ff3b30;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  background: #f2f2f7;

  /* hide scrollbar on mobile while keeping scroll */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
`;

const EmptyLock = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(79, 142, 247, 0.1);
  color: #4f8ef7;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const EmptyTitle = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
`;

const EmptyHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
  max-width: 240px;
`;
