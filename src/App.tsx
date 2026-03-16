import { useCallback, useEffect, useState } from 'react';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import { useWebRTC } from './hooks/useWebRTC';
import { useCall } from './hooks/useCall';
import { HomeScreen } from './screens/HomeScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { OfferScreen } from './screens/OfferScreen';
import { JoinScreen } from './screens/JoinScreen';
import { ChatScreen } from './screens/ChatScreen';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { getContacts } from './services/storage.service';
import { shortId } from './services/identity.service';
import type { Contact } from './types';

export function App() {
  const { state, errorMessage, offerCode, answerCode, peerId, chatService, startOffer, submitAnswer, startJoin, submitOffer, reset, reconnect, meshReady, connectedPeers, contactsVersion, meshNodeRef: meshNode } = useWebRTC();
  const call = useCall(meshNode);
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());

  // When accepting an incoming call, open the chat with that peer
  const handleAcceptCall = useCallback(() => {
    const incomingPeerId = call.incomingCallPeerId;
    call.acceptCall();
    if (incomingPeerId) {
      reconnect(incomingPeerId);
    }
  }, [call, reconnect]);

  // Show global call bar when in a call but not on the chat screen with that peer
  const showGlobalCallBar = call.callState !== 'idle'
    && call.callState !== 'incoming_ringing'
    && !(state === 'connected' && peerId === call.callPeerId);

  // Refresh contacts list when returning to idle or when a background message arrives
  useEffect(() => {
    if (state === 'idle') setContacts(getContacts());
  }, [state, contactsVersion]);

  return (
    <>
      <GlobalStyle />
      {call.incomingCallPeerId && (
        <IncomingCallOverlay
          peerId={call.incomingCallPeerId}
          onAccept={handleAcceptCall}
          onReject={call.rejectCall}
        />
      )}
      {call.callError && <CallErrorToast>{call.callError}</CallErrorToast>}
      <Shell>
        {showGlobalCallBar && (
          <GlobalCallBar>
            <GlobalCallLeft>
              <GlobalCallDot />
              <GlobalCallText>
                {call.callState === 'active'
                  ? `In call${call.callPeerId ? ` · ${shortId(call.callPeerId)}` : ''}`
                  : 'Calling...'}
              </GlobalCallText>
            </GlobalCallLeft>
            <GlobalHangUpButton onClick={call.hangUp} aria-label="Hang up">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.45 8.74 7.46 7 12 7s8.55 1.74 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.991.991 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </GlobalHangUpButton>
          </GlobalCallBar>
        )}
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
          <ChatScreen
            chatService={chatService}
            peerId={peerId}
            onEnd={reset}
            isOnline={connectedPeers.has(peerId)}
            callState={call.callPeerId === peerId ? call.callState : undefined}
            callDuration={call.callDuration}
            isMuted={call.isMuted}
            onStartCall={() => call.startCall(peerId)}
            onHangUp={call.hangUp}
            onToggleMute={call.toggleMute}
          />
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

const globalCallPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const GlobalCallBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #1a3a2a;
  border-bottom: 1px solid rgba(52, 199, 89, 0.2);
  flex-shrink: 0;
`;

const GlobalCallLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const GlobalCallDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c759;
  animation: ${globalCallPulse} 1.5s ease-in-out infinite;
`;

const GlobalCallText = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #34c759;
`;

const GlobalHangUpButton = styled.button`
  width: 32px;
  height: 32px;
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

const CallErrorToast = styled.div`
  position: fixed;
  top: max(20px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: #ff3b30;
  color: white;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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
