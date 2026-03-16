import styled, { keyframes } from 'styled-components';
import { shortId } from '../services/identity.service';
import { getContact } from '../services/storage.service';

interface Props {
  peerId: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({ peerId, onAccept, onReject }: Props) {
  const contact = getContact(peerId);
  const name = contact?.name ?? `Peer ${shortId(peerId)}`;

  return (
    <Overlay>
      <Content>
        <PulseRing />
        <CallerAvatar>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.48 0 4.5-2.02 4.5-4.5S14.48 3 12 3 7.5 5.02 7.5 7.5 9.52 12 12 12zm0 2.25c-3.01 0-9 1.51-9 4.5V21h18v-2.25c0-2.99-5.99-4.5-9-4.5z" />
          </svg>
        </CallerAvatar>
        <CallerName>{name}</CallerName>
        <CallerLabel>Incoming audio call</CallerLabel>

        <ButtonRow>
          <RejectButton onClick={onReject} aria-label="Decline">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.45 8.74 7.46 7 12 7s8.55 1.74 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.991.991 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </RejectButton>
          <AcceptButton onClick={onAccept} aria-label="Accept">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </AcceptButton>
        </ButtonRow>
      </Content>
    </Overlay>
  );
}

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1); opacity: 0.4; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(10, 22, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.25s ease-out;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  position: relative;
`;

const PulseRing = styled.div`
  position: absolute;
  top: -20px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(52, 199, 89, 0.15);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const CallerAvatar = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(79, 142, 247, 0.2);
  color: #4f8ef7;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const CallerName = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: white;
`;

const CallerLabel = styled.p`
  margin: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.5);
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 48px;
  margin-top: 40px;
`;

const RejectButton = styled.button`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: #ff3b30;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s;
  &:active { transform: scale(0.92); }
`;

const AcceptButton = styled.button`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: #34c759;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s;
  &:active { transform: scale(0.92); }
`;
