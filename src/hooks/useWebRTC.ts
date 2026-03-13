import { useCallback, useRef, useState } from 'react';
import { WebRTCService } from '../services/webrtc.service';
import { ChatService } from '../services/chat.service';
import type { ConnectionState } from '../types';
import { decodeSignal, encodeSignal } from '../utils/encoding';

export interface WebRTCHandle {
  state: ConnectionState;
  errorMessage: string;
  offerCode: string;
  answerCode: string;
  chatService: ChatService | null;
  startOffer: () => Promise<void>;
  submitAnswer: (code: string) => Promise<void>;
  startJoin: () => void;
  submitOffer: (code: string) => Promise<void>;
  reset: () => void;
}

export function useWebRTC(): WebRTCHandle {
  const [state, setState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [chatService, setChatService] = useState<ChatService | null>(null);

  const webrtcRef = useRef<WebRTCService | null>(null);
  // Incremented on every reset so stale async closures can bail out early
  const sessionRef = useRef(0);

  const reset = useCallback(() => {
    sessionRef.current += 1;
    webrtcRef.current?.close();
    webrtcRef.current = null;
    setState('idle');
    setErrorMessage('');
    setOfferCode('');
    setAnswerCode('');
    setChatService(null);
  }, []);

  const startOffer = useCallback(async () => {
    setState('gathering');
    setErrorMessage('');
    const session = ++sessionRef.current;
    const webrtc = new WebRTCService();
    webrtcRef.current = webrtc;

    webrtc.onChannelOpen = () => {
      if (session !== sessionRef.current) return;
      const chat = new ChatService(webrtc);
      setChatService(chat);
      setState('connected');
    };

    try {
      const offer = await webrtc.createOffer();
      if (session !== sessionRef.current) return;
      setOfferCode(encodeSignal(offer));
      setState('awaiting_answer');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create offer');
      setState('error');
    }
  }, []);

  const submitAnswer = useCallback(async (code: string) => {
    const webrtc = webrtcRef.current;
    if (!webrtc) return;
    try {
      const answer = decodeSignal(code);
      await webrtc.submitAnswer(answer);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid answer code');
      setState('error');
    }
  }, []);

  const startJoin = useCallback(() => {
    setState('joining');
    setErrorMessage('');
  }, []);

  const submitOffer = useCallback(async (code: string) => {
    setState('generating_answer');
    setErrorMessage('');
    const session = ++sessionRef.current;
    const webrtc = new WebRTCService();
    webrtcRef.current = webrtc;

    webrtc.onChannelOpen = () => {
      if (session !== sessionRef.current) return;
      const chat = new ChatService(webrtc);
      setChatService(chat);
      setState('connected');
    };

    try {
      const offer = decodeSignal(code);
      const answer = await webrtc.createAnswer(offer);
      if (session !== sessionRef.current) return;
      setAnswerCode(encodeSignal(answer));
      setState('has_answer');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Invalid offer code');
      setState('error');
    }
  }, []);

  return { state, errorMessage, offerCode, answerCode, chatService, startOffer, submitAnswer, startJoin, submitOffer, reset };
}
