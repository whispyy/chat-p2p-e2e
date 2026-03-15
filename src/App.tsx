import { useEffect, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useWebRTC } from './hooks/useWebRTC';
import { HomeScreen } from './screens/HomeScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { OfferScreen } from './screens/OfferScreen';
import { JoinScreen } from './screens/JoinScreen';
import { ChatScreen } from './screens/ChatScreen';
import { getContacts } from './services/storage.service';
import type { Contact } from './types';

export function App() {
  const { state, errorMessage, offerCode, answerCode, peerId, chatService, startOffer, submitAnswer, startJoin, submitOffer, reset, reconnect, meshReady, connectedPeers, contactsVersion } = useWebRTC();
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());

  // Refresh contacts list when returning to idle or when a background message arrives
  useEffect(() => {
    if (state === 'idle') setContacts(getContacts());
  }, [state, contactsVersion]);

  return (
    <>
      <GlobalStyle />
      <Shell>
        {state === 'idle' && (
          contacts.length > 0
            ? <ContactsScreen contacts={contacts} onNewChat={startOffer} onJoinChat={startJoin} onReconnect={reconnect} meshReady={meshReady} connectedPeers={connectedPeers} />
            : <HomeScreen onNewChat={startOffer} onJoinChat={startJoin} />
        )}
        {(state === 'gathering' || state === 'awaiting_answer') && (
          <OfferScreen
            offerCode={offerCode}
            isGathering={state === 'gathering'}
            onSubmitAnswer={submitAnswer}
            onBack={reset}
          />
        )}
        {(state === 'joining' || state === 'generating_answer' || state === 'has_answer') && (
          <JoinScreen
            answerCode={answerCode}
            isGenerating={state === 'generating_answer'}
            onSubmitOffer={submitOffer}
            onBack={reset}
          />
        )}
        {state === 'reconnecting' && (
          <ReconnectingScreen onBack={reset} />
        )}
        {state === 'connected' && chatService && (
          <ChatScreen chatService={chatService} peerId={peerId} onEnd={reset} isOnline={connectedPeers.has(peerId)} />
        )}
        {state === 'error' && (
          <ErrorScreen message={errorMessage} onBack={reset} />
        )}
      </Shell>
    </>
  );
}

function ReconnectingScreen({ onBack }: { onBack: () => void }) {
  return (
    <ErrorContainer>
      <ErrorTitle>Reconnecting...</ErrorTitle>
      <ErrorMessage>Searching for relay peers to re-establish connection.</ErrorMessage>
      <BackButton onClick={onBack}>Cancel</BackButton>
    </ErrorContainer>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <ErrorContainer>
      <ErrorIcon>⚠️</ErrorIcon>
      <ErrorTitle>Something went wrong</ErrorTitle>
      <ErrorMessage>{message || 'An unexpected error occurred.'}</ErrorMessage>
      <BackButton onClick={onBack}>Go back</BackButton>
    </ErrorContainer>
  );
}

const ErrorContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 16px;
  text-align: center;
  background: #0a1628;
`;

const ErrorIcon = styled.div`font-size: 48px;`;
const ErrorTitle = styled.h2`margin: 0; font-size: 20px; font-weight: 700; color: white;`;
const ErrorMessage = styled.p`margin: 0; font-size: 15px; color: rgba(255,255,255,0.45); line-height: 1.5;`;

const BackButton = styled.button`
  margin-top: 8px;
  padding: 14px 32px;
  border-radius: 12px;
  border: none;
  background: #4f8ef7;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
`;

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    height: 100%;
    overflow: hidden;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #e5e5ea;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: #0a1628;

  @media (min-width: 520px) {
    height: calc(100% - 48px);
    margin-top: 24px;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.4);
  }
`;
