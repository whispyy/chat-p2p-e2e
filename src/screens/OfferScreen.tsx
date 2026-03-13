import { useState } from 'react';
import styled from 'styled-components';
import { CodeBlock } from '../components/CodeBlock';

interface OfferScreenProps {
  offerCode: string;
  isGathering: boolean;
  onSubmitAnswer: (code: string) => Promise<void>;
  onBack: () => void;
}

export function OfferScreen({ offerCode, isGathering, onSubmitAnswer, onBack }: OfferScreenProps) {
  const [answerInput, setAnswerInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    await onSubmitAnswer(answerInput);
    setIsConnecting(false);
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={onBack} aria-label="Go back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </BackButton>
        <HeaderTitle>New chat</HeaderTitle>
        <HeaderSpacer />
      </Header>

      <Content>
        <Step>
          <StepLabel>Step 1 — Share your offer</StepLabel>
          {isGathering ? (
            <Gathering>
              <Spinner />
              Generating offer…
            </Gathering>
          ) : (
            <CodeBlock value={offerCode} readOnly />
          )}
        </Step>

        <Step>
          <StepLabel>Step 2 — Paste their answer</StepLabel>
          <CodeBlock
            value={answerInput}
            onChange={setAnswerInput}
            placeholder="Paste answer code here…"
          />
          <ConnectButton
            onClick={handleConnect}
            disabled={!answerInput.trim() || isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Connect'}
          </ConnectButton>
        </Step>
      </Content>
    </Container>
  );
}

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a1628;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: max(14px, env(safe-area-inset-top)) 16px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
`;

const BackButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:active { background: rgba(255, 255, 255, 0.12); }
`;

const HeaderTitle = styled.h2`
  flex: 1;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: white;
  text-align: center;
`;

const HeaderSpacer = styled.div`width: 36px; flex-shrink: 0;`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 36px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const Step = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StepLabel = styled.p`
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Gathering = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
`;

const spin = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: #4f8ef7;
  animation: spin 0.7s linear infinite;
  ${spin}
`;

const ConnectButton = styled.button`
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  border: none;
  background: white;
  color: #0a1628;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.1px;
  transition: transform 0.12s, box-shadow 0.12s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);

  &:disabled {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
    cursor: default;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
`;
