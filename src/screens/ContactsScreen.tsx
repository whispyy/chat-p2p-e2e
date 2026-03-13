import { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import type { Contact } from '../types';
import { shortId } from '../services/identity.service';
import { SettingsModal } from '../components/SettingsModal';

interface ContactsScreenProps {
  contacts: Contact[];
  onNewChat: () => void;
  onJoinChat: () => void;
}

export function ContactsScreen({ contacts, onNewChat, onJoinChat }: ContactsScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Container>
      <BlobA />
      <BlobB />

      <Header>
        <HeaderText>
          <AppName>Peer Chat</AppName>
          <HeaderSub>Your conversations</HeaderSub>
        </HeaderText>
        <SettingsButton onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </SettingsButton>
      </Header>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <List>
        {contacts.map((contact) => (
          <ContactRow key={contact.id} contact={contact} onReconnect={onNewChat} />
        ))}
      </List>

      <Actions>
        <PrimaryButton onClick={onNewChat}>
          Start new chat
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </PrimaryButton>
        <SecondaryButton onClick={onJoinChat}>Join a chat</SecondaryButton>
      </Actions>
    </Container>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────

function ContactRow({ contact, onReconnect }: { contact: Contact; onReconnect: () => void }) {
  const last = contact.lastMessage;
  const preview = last ? (last.fromMe ? `You: ${last.text}` : last.text) : 'No messages yet';
  const truncated = preview.length > 48 ? preview.slice(0, 48) + '…' : preview;

  return (
    <Row onClick={onReconnect}>
      <Avatar $color={avatarColor(contact.id)}>
        {shortId(contact.id).slice(0, 2)}
      </Avatar>
      <RowBody>
        <RowTop>
          <ContactName>{contact.name}</ContactName>
          <TimeStamp>{formatTime(contact.lastSeen)}</TimeStamp>
        </RowTop>
        <Preview>{truncated}</Preview>
      </RowBody>
    </Row>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#4f8ef7', '#7c6af7', '#f76a8f', '#f7a24f',
  '#4fc8f7', '#6af7c8', '#f7e44f', '#c86af7',
];

function avatarColor(id: string): string {
  const n = id.replace(/-/g, '').charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[n];
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)   return 'now';
  if (m < 60)  return `${m}m`;
  if (h < 24)  return `${h}h`;
  if (d < 7)   return `${d}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Animations ──────────────────────────────────────────────────────────

const blobFloatA = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(24px, -32px) scale(1.08); }
`;
const blobFloatB = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(-20px, 24px) scale(1.06); }
`;
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Styles ───────────────────────────────────────────────────────────────

const Container = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(160deg, #0a1628 0%, #0f2044 55%, #091526 100%);
`;

const BlobA = styled.div`
  position: absolute;
  width: 420px; height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(79, 142, 247, 0.18) 0%, transparent 70%);
  top: -120px; right: -80px;
  animation: ${blobFloatA} 10s ease-in-out infinite;
  pointer-events: none;
`;

const BlobB = styled.div`
  position: absolute;
  width: 340px; height: 340px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(120, 80, 255, 0.12) 0%, transparent 70%);
  bottom: 60px; left: -80px;
  animation: ${blobFloatB} 13s ease-in-out infinite;
  pointer-events: none;
`;

const Header = styled.div`
  position: relative;
  z-index: 1;
  padding: max(52px, env(safe-area-inset-top)) 24px 20px;
  animation: ${fadeUp} 0.4s ease-out both;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
`;

const AppName = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.5px;
`;

const HeaderSub = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
`;

const SettingsButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
  &:active {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.9);
  }
`;

const List = styled.div`
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  animation: ${fadeUp} 0.45s ease-out both;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  cursor: pointer;
  transition: background 0.12s;

  &:active {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const Avatar = styled.div<{ $color: string }>`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: ${({ $color }) => $color}22;
  border: 1.5px solid ${({ $color }) => $color}55;
  color: ${({ $color }) => $color};
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.5px;
`;

const RowBody = styled.div`
  flex: 1;
  min-width: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 14px;

  ${Row}:last-child & {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const RowTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
`;

const ContactName = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TimeStamp = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
`;

const Preview = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Actions = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 24px max(28px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.07);
`;

const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 16px 24px;
  border-radius: 14px;
  border: none;
  background: white;
  color: #0a1628;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.1px;
  transition: transform 0.12s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);

  &:active { transform: scale(0.98); }
`;

const SecondaryButton = styled.button`
  width: 100%;
  padding: 15px 24px;
  border-radius: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.12s;

  &:active {
    background: rgba(255, 255, 255, 0.06);
    transform: scale(0.98);
  }
`;
