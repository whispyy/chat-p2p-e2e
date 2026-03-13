import styled, { keyframes } from 'styled-components';

interface HomeScreenProps {
  onNewChat: () => void;
  onJoinChat: () => void;
}

export function HomeScreen({ onNewChat, onJoinChat }: HomeScreenProps) {
  return (
    <Container>
      <BlobA />
      <BlobB />

      <Content>
        <Hero>
          <IconBadge>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </IconBadge>

          <TitleGroup>
            <AppName>Peer Chat</AppName>
            <Tagline>Private. Direct. Encrypted.</Tagline>
          </TitleGroup>

          <Chips>
            <Chip>
              <ChipDot />
              No servers
            </Chip>
            <Chip>
              <ChipDot />
              End-to-end encrypted
            </Chip>
            <Chip>
              <ChipDot />
              Nothing stored
            </Chip>
          </Chips>
        </Hero>

        <Actions>
          <PrimaryButton onClick={onNewChat}>
            Start new chat
            <ArrowIcon />
          </PrimaryButton>
          <SecondaryButton onClick={onJoinChat}>
            Join a chat
          </SecondaryButton>
        </Actions>
      </Content>
    </Container>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─── Animations ────────────────────────────────────────────────────

const blobFloatA = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(24px, -32px) scale(1.08); }
`;

const blobFloatB = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(-20px, 24px) scale(1.06); }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Styles ────────────────────────────────────────────────────────

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
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(79, 142, 247, 0.18) 0%, transparent 70%);
  top: -120px;
  right: -80px;
  animation: ${blobFloatA} 10s ease-in-out infinite;
  pointer-events: none;
`;

const BlobB = styled.div`
  position: absolute;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(120, 80, 255, 0.12) 0%, transparent 70%);
  bottom: 60px;
  left: -80px;
  animation: ${blobFloatB} 13s ease-in-out infinite;
  pointer-events: none;
`;

const Content = styled.div`
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: max(56px, env(safe-area-inset-top)) 28px max(36px, env(safe-area-inset-bottom));
  animation: ${fadeUp} 0.5s ease-out both;
`;

const Hero = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  text-align: center;
`;

const IconBadge = styled.div`
  width: 88px;
  height: 88px;
  border-radius: 26px;
  background: linear-gradient(145deg, rgba(79, 142, 247, 0.25), rgba(79, 142, 247, 0.10));
  border: 1.5px solid rgba(79, 142, 247, 0.35);
  box-shadow: 0 0 48px rgba(79, 142, 247, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const AppName = styled.h1`
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5px;
  line-height: 1.1;
`;

const Tagline = styled.p`
  margin: 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
  letter-spacing: 0.2px;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.1px;
`;

const ChipDot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4f8ef7;
  opacity: 0.8;
  flex-shrink: 0;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 17px 24px;
  border-radius: 16px;
  border: none;
  background: #ffffff;
  color: #0a1628;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.1px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  }
`;

const SecondaryButton = styled.button`
  width: 100%;
  padding: 17px 24px;
  border-radius: 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  letter-spacing: -0.1px;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;

  &:active {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(0.98);
  }
`;
