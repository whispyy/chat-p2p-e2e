import styled, { keyframes } from 'styled-components';

interface Props {
  duration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ActiveCallBar({ duration, isMuted, onToggleMute, onHangUp }: Props) {
  return (
    <Bar>
      <Left>
        <LiveDot />
        <DurationText>{formatDuration(duration)}</DurationText>
      </Left>
      <Right>
        <MuteButton onClick={onToggleMute} $active={isMuted} aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          )}
        </MuteButton>
        <HangUpButton onClick={onHangUp} aria-label="Hang up">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.45 8.74 7.46 7 12 7s8.55 1.74 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.991.991 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </HangUpButton>
      </Right>
    </Bar>
  );
}

const livePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #1a3a2a;
  border-bottom: 1px solid rgba(52, 199, 89, 0.2);
  flex-shrink: 0;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LiveDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c759;
  animation: ${livePulse} 1.5s ease-in-out infinite;
`;

const DurationText = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #34c759;
  font-variant-numeric: tabular-nums;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MuteButton = styled.button<{ $active: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: ${({ $active }) => $active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
  color: ${({ $active }) => $active ? '#ff9500' : 'rgba(255,255,255,0.7)'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
`;

const HangUpButton = styled.button`
  width: 34px;
  height: 34px;
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
